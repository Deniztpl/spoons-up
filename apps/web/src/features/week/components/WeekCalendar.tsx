import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import { describeDuration, formatDuration } from "../../../lib/duration";
import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { NewTaskDefaults } from "../../tasks/hooks/useTaskForm";
import type { WeekResponse, WeekTask } from "../api/weekApi";
import { minutesToTime, timeToMinutes } from "../calendarTime";
import {
  type CalendarColumn,
  type CalendarInteraction,
  useCalendarInteraction,
} from "../hooks/useCalendarInteraction";
import type { TaskPlacement } from "../hooks/useWeek";

const HOUR_HEIGHT = 64;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
// Short enough to fit a one-line title, tall enough to click.
const MIN_BLOCK_HEIGHT = 18;
// Blocks at least this tall show a time row above the title.
const TALL_BLOCK_HEIGHT = 40;
// Blocks of 90 minutes or more also name their area under the title.
const AREA_LABEL_BLOCK_HEIGHT = 94;
// A step's block names its item under the title once there is room for the line.
const PARENT_LABEL_BLOCK_HEIGHT = 56;
const LAST_START_MINUTES = 23 * 60 + 45;
const calendarColumns = "grid grid-cols-[52px_repeat(7,minmax(0,1fr))]";
// Midnight would sit on the top edge, so the scale is labelled from 01:00.
const labelledHours = Array.from({ length: 23 }, (_, index) => index + 1);
const halfHour = HOUR_HEIGHT / 2;
const hourLines: CSSProperties = {
  backgroundImage: `repeating-linear-gradient(to bottom, rgb(28 43 33 / 0.075) 0 1px, transparent 1px ${halfHour}px, rgb(28 43 33 / 0.035) ${halfHour}px ${halfHour + 1}px, transparent ${halfHour + 1}px ${HOUR_HEIGHT}px)`,
};
const dayNameFormat = new Intl.DateTimeFormat("en", { weekday: "short" });
const dayInitialFormat = new Intl.DateTimeFormat("en", { weekday: "narrow" });
const dayNumberFormat = new Intl.DateTimeFormat("en", { day: "numeric" });
const fullDateFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

type WeekCalendarProps = {
  week: WeekResponse;
  todayDate: string;
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: Set<string>;
  onCreate: (defaults: NewTaskDefaults) => void;
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
  onPlace: (task: WeekTask, placement: TaskPlacement) => void;
  onPaste: (task: WeekTask, spot: { date: string; startTime: string | null }) => void;
  onRequestDelete: (task: WeekTask) => void;
};

// Where Ctrl or Cmd+V puts a copy: a quarter hour on a day, or the day's untimed row.
type PasteSpot = { date: string; startMinutes: number | null };

type BlockPlacement = {
  top: number;
  height: number;
  left: string;
  width: string;
};

// What the calendar's tasks and slots need for selecting, pressing, dragging and resizing.
type TaskInteraction = {
  interaction: CalendarInteraction | null;
  selectedId: string | null;
  pasteSpot: PasteSpot | null;
  pressTask: (event: PointerEvent<HTMLElement>, task: WeekTask, mode: "move" | "resize") => void;
  isClickIgnored: () => boolean;
  onSelect: (task: WeekTask) => void;
  onEdit: (task: WeekTask) => void;
  onSetPasteSpot: (spot: PasteSpot) => void;
};

export function WeekCalendar({
  week,
  todayDate,
  areaByGoalId,
  pendingTaskIds,
  onCreate,
  onEdit,
  onToggle,
  onPlace,
  onPaste,
  onRequestDelete,
}: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pasteSpot, setPasteSpot] = useState<PasteSpot | null>(null);
  const copiedRef = useRef<WeekTask | null>(null);
  const selectedTask =
    selectedId === null
      ? null
      : (week.days.flatMap((day) => day.tasks).find((task) => task.id === selectedId) ?? null);
  const { interaction, pressTask, pressSlot, moveOver, isClickIgnored } = useCalendarInteraction(
    { onPlace, onDraw: onCreate },
    HOUR_HEIGHT,
  );
  const defaultSelectedDate =
    week.days.find((day) => day.date === todayDate)?.date ?? week.days[0]?.date ?? todayDate;
  // A day picked in one week does not carry over to the other week.
  const [selection, setSelection] = useState({
    periodStart: week.period_start,
    date: defaultSelectedDate,
  });
  const selectedDate =
    selection.periodStart === week.period_start ? selection.date : defaultSelectedDate;

  // Open with the current time a quarter of the way down, once the grid has a size; on a
  // narrow screen that happens when it is widened. Switching weeks keeps the scroll.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (element.clientHeight === 0) return;
      element.scrollTop = (currentMinutes() / 60) * HOUR_HEIGHT - element.clientHeight / 4;
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Shortcuts act on the calendar, not on a dialog or a field being typed in.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      const withModifier = event.ctrlKey || event.metaKey;
      if (withModifier && key === "c") {
        // A step is planned only from its item, so it is not copied.
        if (selectedTask && selectedTask.parent_id === null) copiedRef.current = selectedTask;
      } else if (withModifier && key === "v") {
        const copied = copiedRef.current;
        if (copied && pasteSpot) {
          event.preventDefault();
          onPaste(copied, {
            date: pasteSpot.date,
            startTime:
              pasteSpot.startMinutes === null ? null : minutesToTime(pasteSpot.startMinutes),
          });
        }
      } else if (key === "delete" || key === "backspace") {
        if (selectedTask) {
          event.preventDefault();
          onRequestDelete(selectedTask);
        }
      } else if (key === "enter") {
        // A focused task's own button opens it; this covers a task picked with the pointer.
        if (selectedTask && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          onEdit(selectedTask);
        }
      } else if (key === "escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask, pasteSpot, onPaste, onRequestDelete, onEdit]);

  const selectedDay =
    week.days.find((day) => day.date === selectedDate) ?? week.days[0];
  const selectedDoneCount =
    selectedDay?.tasks.filter((task) => task.status === "DONE").length ?? 0;
  const taskInteraction: TaskInteraction = {
    interaction,
    selectedId,
    pasteSpot,
    pressTask,
    isClickIgnored,
    onSelect: (task) => setSelectedId(task.id),
    onEdit,
    // Picking an empty spot also lets go of the selected task.
    onSetPasteSpot: (spot) => {
      setPasteSpot(spot);
      setSelectedId(null);
    },
  };

  return (
    <>
      <div
        ref={scrollRef}
        className={`hidden min-h-0 min-w-0 flex-1 select-none overflow-y-auto pb-6 md:block ${interactionCursor(interaction)}`}
      >
        <div className="min-w-[700px]">
          <div className="sticky top-0 z-[6] border-b border-ink/12 bg-canvas">
            <div className={`${calendarColumns} pb-2.5 pt-0.5`}>
              <div />
              {week.days.map((day) => {
                const isToday = day.date === todayDate;
                return (
                  <div key={day.date} className="flex min-w-0 items-center gap-[7px] pl-2.5">
                    <span
                      className={`text-[12px] font-medium ${isToday ? "text-accent" : "text-ink-soft"}`}
                    >
                      {dayNameFormat.format(localDate(day.date))}
                    </span>
                    <span
                      className={`grid h-[26px] min-w-[26px] place-items-center rounded-full text-sm font-semibold ${
                        isToday ? "bg-accent text-white" : "text-ink"
                      }`}
                    >
                      {dayNumberFormat.format(localDate(day.date))}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`${calendarColumns} border-t border-ink/8`}>
              <div className="pr-2 pt-[7px] text-right text-[10.5px] text-muted">Untimed</div>
              {week.days.map((day) => (
                <UntimedRow
                  key={day.date}
                  date={day.date}
                  isToday={day.date === todayDate}
                  isPast={day.date < todayDate}
                  tasks={day.tasks.filter((task) => task.start_time === null)}
                  areaByGoalId={areaByGoalId}
                  pendingTaskIds={pendingTaskIds}
                  taskInteraction={taskInteraction}
                  onToggle={onToggle}
                  onPointerMove={moveOver}
                />
              ))}
            </div>
          </div>

          <div className={calendarColumns} style={{ height: DAY_HEIGHT }}>
            <div aria-hidden="true" className="relative">
              {labelledHours.map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted tabular-nums"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {minutesToTime(hour * 60)}
                </span>
              ))}
            </div>
            {week.days.map((day) => (
              <DayTimeline
                key={day.date}
                date={day.date}
                isToday={day.date === todayDate}
                isPast={day.date < todayDate}
                tasks={day.tasks.filter((task) => task.start_time !== null)}
                areaByGoalId={areaByGoalId}
                pendingTaskIds={pendingTaskIds}
                taskInteraction={taskInteraction}
                onCreate={onCreate}
                onToggle={onToggle}
                onPressSlot={pressSlot}
                onPointerMove={moveOver}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="grid grid-cols-7 gap-1">
          {week.days.map((day) => {
            const isSelected = day.date === selectedDay?.date;
            const isToday = day.date === todayDate;
            return (
              <button
                key={day.date}
                type="button"
                aria-pressed={isSelected}
                aria-label={fullDateFormat.format(localDate(day.date))}
                className={`flex min-w-0 flex-col items-center gap-[3px] rounded-[10px] pb-1.5 pt-[7px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isSelected
                    ? "bg-accent text-white"
                    : `${isToday ? "text-accent" : "text-ink-soft"} hover:bg-well`
                }`}
                onClick={() => setSelection({ periodStart: week.period_start, date: day.date })}
              >
                <span className="text-[10.5px] font-medium">
                  {dayInitialFormat.format(localDate(day.date))}
                </span>
                <span className="text-[15px] font-semibold leading-tight">
                  {dayNumberFormat.format(localDate(day.date))}
                </span>
                <span
                  aria-hidden="true"
                  className={`size-1 rounded-full ${
                    day.tasks.length === 0 ? "" : isSelected ? "bg-white" : "bg-accent/55"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section className="mt-3.5 min-h-0 flex-1 overflow-y-auto pb-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold">
                {fullDateFormat.format(localDate(selectedDay.date))}
              </h2>
              {selectedDay.tasks.length > 0 ? (
                <span className="text-[12px] text-ink-soft tabular-nums">
                  {selectedDoneCount}/{selectedDay.tasks.length}
                  <span className="sr-only"> done</span>
                </span>
              ) : null}
            </div>

            <div className="mt-3.5 flex flex-col gap-1.5">
              {selectedDay.tasks.length > 0 ? (
                <ul aria-label={`Tasks for ${selectedDay.date}`} className="flex flex-col gap-1.5">
                  {[...selectedDay.tasks]
                    .sort((left, right) => (left.start_time ?? "").localeCompare(right.start_time ?? ""))
                    .map((task) => (
                      <li key={task.id}>
                        <MobileTaskCard
                          task={task}
                          area={taskArea(task, areaByGoalId)}
                          isPending={pendingTaskIds.has(task.id)}
                          onEdit={onEdit}
                          onToggle={onToggle}
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="pb-2 pt-[22px] text-center text-[13px] text-ink-soft">
                  No tasks for this day.
                </p>
              )}

              {selectedDay.date >= todayDate ? (
                <button
                  type="button"
                  className="flex min-h-12 items-center justify-center gap-1 rounded-[10px] border border-dashed border-ink/18 text-[13.5px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => onCreate({ scheduledDate: selectedDay.date })}
                >
                  <span aria-hidden="true">+</span>
                  Add task
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function UntimedRow({
  date,
  isToday,
  isPast,
  tasks,
  areaByGoalId,
  pendingTaskIds,
  taskInteraction,
  onToggle,
  onPointerMove,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  tasks: WeekTask[];
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: Set<string>;
  taskInteraction: TaskInteraction;
  onToggle: (task: WeekTask) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>, column: CalendarColumn) => void;
}) {
  const { interaction, pasteSpot, isClickIgnored, onSetPasteSpot } = taskInteraction;
  const moving = interaction?.kind === "move" ? interaction : null;
  const isTarget = moving?.target?.date === date && moving.target.startMinutes === null;
  const isPasteSpot = pasteSpot?.date === date && pasteSpot.startMinutes === null;

  return (
    <div
      role="group"
      aria-label={`Untimed tasks for ${date}`}
      className={`relative flex min-h-[30px] min-w-0 flex-col gap-1 border-l border-ink/10 py-1 pl-0.5 pr-[3px] ${columnBackground(
        isTarget,
        isToday,
        isPast,
      )}`}
      onPointerMove={(event) => onPointerMove(event, { date, zone: "untimed", isPast })}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isPast && !isClickIgnored()) {
          onSetPasteSpot({ date, startMinutes: null });
        }
      }}
    >
      {isPasteSpot ? <PasteMarker className="inset-0.5" /> : null}
      {tasks.map((task) => (
        <TaskBlock
          key={task.id}
          task={task}
          area={taskArea(task, areaByGoalId)}
          isPast={isPast}
          isPending={pendingTaskIds.has(task.id)}
          taskInteraction={taskInteraction}
          onToggle={onToggle}
        />
      ))}
      {isTarget && moving ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none flex h-[22px] shrink-0 items-center gap-1.5 rounded-[7px] border border-dashed px-1.5 text-[11px] font-medium text-ink ${ghostTone(moving.task)} ${areaColorClass(taskArea(moving.task, areaByGoalId))}`}
        >
          <span className="min-w-0 flex-1 truncate">{moving.task.title}</span>
          {moving.task.duration_minutes !== null ? (
            <span className="shrink-0 text-ink-soft tabular-nums">
              {formatDuration(moving.task.duration_minutes)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DayTimeline({
  date,
  isToday,
  isPast,
  tasks,
  areaByGoalId,
  pendingTaskIds,
  taskInteraction,
  onCreate,
  onToggle,
  onPressSlot,
  onPointerMove,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  tasks: WeekTask[];
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: Set<string>;
  taskInteraction: TaskInteraction;
  onCreate: WeekCalendarProps["onCreate"];
  onToggle: (task: WeekTask) => void;
  onPressSlot: (event: PointerEvent<HTMLElement>, date: string) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>, column: CalendarColumn) => void;
}) {
  const { interaction, pasteSpot, isClickIgnored, onSetPasteSpot } = taskInteraction;
  // A task being resized takes its new length in the layout while the edge is dragged.
  const shownTasks = tasks.map((task) =>
    interaction?.kind === "resize" && interaction.task.id === task.id
      ? { ...task, duration_minutes: interaction.durationMinutes }
      : task,
  );
  const laidOutTasks = layoutTimedTasks(shownTasks);
  const moving = interaction?.kind === "move" ? interaction : null;
  const moveTarget =
    moving?.target?.date === date && moving.target.startMinutes !== null ? moving.target : null;
  const drawing = interaction?.kind === "draw" && interaction.date === date ? interaction : null;
  const pasteMinutes =
    pasteSpot?.date === date && pasteSpot.startMinutes !== null ? pasteSpot.startMinutes : null;

  // A click picks the quarter hour under the pointer as the paste spot. A keyboard press has no
  // pointer position, so it proposes a task at the start of a working day instead.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) {
      onCreate({ scheduledDate: date, startTime: "09:00", durationMinutes: 60 });
      return;
    }
    if (isClickIgnored()) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const minutes = ((event.clientY - bounds.top) / HOUR_HEIGHT) * 60;
    onSetPasteSpot({ date, startMinutes: clampStart(Math.floor(minutes / 15) * 15) });
  }

  // A double-click proposes an hour from the quarter hour under the pointer.
  function handleDoubleClick(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const minutes = ((event.clientY - bounds.top) / HOUR_HEIGHT) * 60;
    onCreate({
      scheduledDate: date,
      startTime: minutesToTime(clampStart(Math.floor(minutes / 15) * 15)),
      durationMinutes: 60,
    });
  }

  return (
    <div
      className={`relative min-w-0 border-l border-ink/10 ${columnBackground(
        moveTarget !== null || drawing !== null,
        isToday,
        isPast,
      )}`}
      style={hourLines}
      onPointerMove={(event) => onPointerMove(event, { date, zone: "timeline", isPast })}
    >
      {!isPast ? (
        <button
          type="button"
          aria-label={`Add a task on ${date}`}
          className="absolute inset-0 cursor-cell focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          onPointerDown={(event) => onPressSlot(event, date)}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
      ) : null}
      {pasteMinutes !== null ? (
        <PasteMarker
          className="inset-x-[2px]"
          style={{ top: (pasteMinutes / 60) * HOUR_HEIGHT, height: HOUR_HEIGHT / 4 }}
        />
      ) : null}
      {isToday ? <NowLine /> : null}
      {laidOutTasks.map(({ task, column, columns }) => (
        <TaskBlock
          key={task.id}
          task={task}
          area={taskArea(task, areaByGoalId)}
          placement={blockPlacement(task, column, columns)}
          isPast={isPast}
          isPending={pendingTaskIds.has(task.id)}
          taskInteraction={taskInteraction}
          onToggle={onToggle}
        />
      ))}
      {moving && moveTarget?.startMinutes != null ? (
        <PlacementGhost
          startMinutes={moveTarget.startMinutes}
          durationMinutes={moving.task.duration_minutes}
          title={moving.task.title}
          className={`${ghostTone(moving.task)} ${areaColorClass(taskArea(moving.task, areaByGoalId))}`}
        />
      ) : null}
      {drawing ? (
        <PlacementGhost
          startMinutes={drawing.startMinutes}
          durationMinutes={drawing.endMinutes - drawing.startMinutes}
          title="New task"
          className="border-accent/50 bg-accent/12"
        />
      ) : null}
    </div>
  );
}

// Where a dragged or drawn task would land, with its time range and hours.
function PlacementGhost({
  startMinutes,
  durationMinutes,
  title,
  className,
}: {
  startMinutes: number;
  durationMinutes: number | null;
  title: string;
  className: string;
}) {
  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const length = ((durationMinutes ?? 30) / 60) * HOUR_HEIGHT;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-[2px] z-[5] overflow-hidden rounded-[7px] border border-dashed px-1.5 py-1 shadow-[0_6px_16px_rgb(28_43_33/0.16)] ${className}`}
      style={{ top, height: Math.max(MIN_BLOCK_HEIGHT, Math.min(length, DAY_HEIGHT - top) - 2) }}
    >
      <div className="text-[10.5px] font-semibold text-ink tabular-nums">
        {rangeLabel(startMinutes, durationMinutes)}
      </div>
      <div className="truncate text-[11px] text-ink-soft">{title}</div>
    </div>
  );
}

// Marks where Ctrl or Cmd+V would put a copy.
function PasteMarker({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-[1] rounded-[5px] border-2 border-dashed border-accent/60 bg-accent/6 ${className}`}
      style={style}
    />
  );
}

// Today's column marks the current time and moves the mark along as the day goes.
function NowLine() {
  const [minutes, setMinutes] = useState(currentMinutes);

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(currentMinutes()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-danger"
      style={{ top: (minutes / 60) * HOUR_HEIGHT }}
    >
      <span className="absolute -left-[5px] -top-1 size-2.5 rounded-full bg-danger" />
    </div>
  );
}

// Timed tasks are placed on the timeline; untimed tasks flow in their row.
function TaskBlock({
  task,
  area,
  placement,
  isPast,
  isPending,
  taskInteraction,
  onToggle,
}: {
  task: WeekTask;
  area: Area | undefined;
  placement?: BlockPlacement;
  isPast: boolean;
  isPending: boolean;
  taskInteraction: TaskInteraction;
  onToggle: (task: WeekTask) => void;
}) {
  const { interaction, selectedId, pressTask, isClickIgnored, onSelect, onEdit } = taskInteraction;
  const isDone = task.status === "DONE";
  const isSelected = selectedId === task.id;
  // Open work on an elapsed day can still move to today or later; finished work stays put,
  // though its length can still change.
  const isMovable = !isPending && !(isPast && isDone);
  const isResizable = !isPending && placement !== undefined;
  const isMoving = interaction?.kind === "move" && interaction.task.id === task.id;
  const isResizing = interaction?.kind === "resize" && interaction.task.id === task.id;
  const isTall = placement !== undefined && placement.height >= TALL_BLOCK_HEIGHT;
  const showsArea = area !== undefined && isTall && placement.height >= AREA_LABEL_BLOCK_HEIGHT;
  const parentLine = task.parent
    ? `${task.parent.title} · ${task.parent.step_progress.done}/${task.parent.step_progress.total}`
    : null;
  const showsParent =
    parentLine !== null && isTall && placement.height >= PARENT_LABEL_BLOCK_HEIGHT;
  const titleClassName = `min-w-0 text-[12px] font-medium leading-[1.25] text-ink ${isDone ? "line-through" : ""}`;
  const badge =
    task.duration_minutes !== null || task.rule_id !== null ? (
      <span
        aria-hidden="true"
        className={`ml-auto flex h-[15px] shrink-0 items-center gap-[3px] rounded-[5px] px-1 text-[9.5px] font-semibold text-white tabular-nums ${
          task.goal_id ? "bg-area-strong" : "bg-ink-soft"
        }`}
      >
        {task.rule_id !== null ? <RepeatIcon className="size-[9px]" /> : null}
        {task.duration_minutes !== null ? formatDuration(task.duration_minutes) : null}
      </span>
    ) : null;

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    // The checkbox checks; it does not pick the task up.
    if (!isMovable || (event.target as Element).closest("label")) return;
    pressTask(event, task, "move");
  }

  return (
    <article
      title={parentLine ? `${task.title} · ${parentLine}` : task.title}
      className={`${
        placement ? "absolute z-[2] hover:z-[3]" : "relative h-[22px] shrink-0"
      } overflow-hidden rounded-[7px] border shadow-[0_1px_2px_rgb(28_43_33/0.06)] transition-shadow hover:shadow-[0_4px_12px_rgb(28_43_33/0.14)] ${
        task.goal_id
          ? "border-area/38 bg-[color-mix(in_oklch,var(--area)_9%,var(--color-card))]"
          : "border-ink/16 bg-card"
      } ${areaColorClass(area)} ${
        isMoving
          ? "pointer-events-none opacity-40"
          : isPending
            ? "cursor-wait opacity-60"
            : isDone
              ? "opacity-50"
              : ""
      } ${isResizing ? "z-[5] ring-2 ring-accent/50" : ""} ${
        isSelected ? "z-[3] ring-2 ring-accent ring-offset-1 ring-offset-canvas" : ""
      } ${isMovable ? "touch-none" : ""}`}
      style={placement}
      onPointerDown={handlePointerDown}
    >
      <button
        type="button"
        aria-label={taskSummary(task, area)}
        aria-pressed={isSelected}
        className={`absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
          isPending ? "cursor-wait" : isMovable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        }`}
        onClick={(event) => {
          // The release that ends a drag is not a click on the task.
          if (isClickIgnored()) return;
          onSelect(task);
          // Enter or Space on a focused task opens it, as a double-click does.
          if (event.detail === 0) onEdit(task);
        }}
        onDoubleClick={() => onEdit(task)}
      />
      <div
        className={`pointer-events-none relative flex h-full min-w-0 gap-x-[5px] gap-y-px px-1.5 ${
          isTall ? "flex-col py-1" : "items-center py-px"
        }`}
      >
        {isTall && placement ? (
          <>
            <div className="flex min-w-0 items-center gap-1">
              <TaskCheck task={task} isPending={isPending} onToggle={onToggle} />
              <span className="shrink-0 text-[10.5px] text-ink-soft tabular-nums">
                {task.start_time}
              </span>
              {badge}
            </div>
            <span
              className={titleClassName}
              style={titleClamp(placement.height - (showsArea || showsParent ? 15 : 0))}
            >
              {task.title}
            </span>
            {showsParent ? (
              <span className="mt-auto truncate text-[10.5px] text-ink-soft">{parentLine}</span>
            ) : null}
            {showsArea ? (
              <span className="mt-auto flex min-w-0 items-center gap-[5px] text-[10.5px] font-medium text-area-strong">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-area" />
                <span className="truncate">{area.name}</span>
              </span>
            ) : null}
          </>
        ) : (
          <>
            <TaskCheck task={task} isPending={isPending} onToggle={onToggle} />
            <span className={`${titleClassName} flex-1 truncate`}>{task.title}</span>
            {badge}
          </>
        )}
      </div>
      {isResizing && task.start_time !== null ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0.5 right-1 rounded-[4px] bg-ink/80 px-1 text-[10px] font-semibold text-white tabular-nums"
        >
          {rangeLabel(timeToMinutes(task.start_time), task.duration_minutes)}
        </span>
      ) : null}
      {isResizable ? (
        // The bottom edge drags the task's length in 15-minute steps.
        <span
          aria-hidden="true"
          data-testid={`resize-${task.id}`}
          className="absolute inset-x-0 bottom-0 z-[1] h-1.5 cursor-ns-resize touch-none"
          onPointerDown={(event) => {
            event.stopPropagation();
            pressTask(event, task, "resize");
          }}
        />
      ) : null}
    </article>
  );
}

function MobileTaskCard({
  task,
  area,
  isPending,
  onEdit,
  onToggle,
}: {
  task: WeekTask;
  area: Area | undefined;
  isPending: boolean;
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
}) {
  const isDone = task.status === "DONE";
  return (
    <div
      className={`flex min-h-[52px] items-center gap-2.5 rounded-[10px] pl-3 ${
        area
          ? `border border-area/38 bg-[color-mix(in_oklch,var(--area)_9%,var(--color-card))] ${areaColorClass(area)}`
          : "bg-card shadow-[0_1px_0_rgb(28_43_33/0.06),0_0_0_1px_rgb(28_43_33/0.07)]"
      } ${isDone ? "opacity-50" : ""}`}
    >
      <TaskCheck task={task} isPending={isPending} onToggle={onToggle} size="large" />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch pr-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => onEdit(task)}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate text-sm font-medium ${isDone ? "line-through" : ""}`}>
            {task.title}
          </span>
          {task.parent ? (
            <span className="truncate text-[11.5px] text-ink-soft">
              {task.parent.title} · {task.parent.step_progress.done}/
              {task.parent.step_progress.total}
            </span>
          ) : null}
        </span>
        {task.rule_id ? (
          <span className="text-ink-soft">
            <RepeatIcon className="size-3" />
            <span className="sr-only">Repeating task</span>
          </span>
        ) : null}
        <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
          {task.start_time ?? "Any time"}
        </span>
      </button>
    </div>
  );
}

function TaskCheck({
  task,
  isPending,
  onToggle,
  size = "small",
}: {
  task: WeekTask;
  isPending: boolean;
  onToggle: (task: WeekTask) => void;
  size?: "small" | "large";
}) {
  const isDone = task.status === "DONE";
  return (
    <label
      className={`pointer-events-auto relative flex shrink-0 ${isPending ? "cursor-wait" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={isDone}
        disabled={isPending}
        aria-label={task.title}
        className="peer sr-only"
        onChange={() => onToggle(task)}
      />
      <span
        aria-hidden="true"
        className={`grid place-items-center border-[1.5px] border-muted text-white transition peer-checked:border-area peer-checked:bg-area peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent ${
          size === "large" ? "size-[18px] rounded-[5px]" : "size-[11px] rounded-[3px]"
        }`}
      >
        {isDone ? <CheckIcon className={size === "large" ? "size-2.5" : "size-[7px]"} /> : null}
      </span>
    </label>
  );
}

function RepeatIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`block shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <path d="M13.2 6A5.5 5.5 0 0 0 3.4 4.2" />
      <path d="M3 1.6v2.9h2.9" />
      <path d="M2.8 10a5.5 5.5 0 0 0 9.8 1.8" />
      <path d="M13 14.4v-2.9h-2.9" />
    </svg>
  );
}

function interactionCursor(interaction: CalendarInteraction | null) {
  if (interaction?.kind === "move") return "cursor-grabbing";
  if (interaction?.kind === "resize") return "cursor-ns-resize";
  if (interaction?.kind === "draw") return "cursor-cell";
  return "";
}

function columnBackground(isTarget: boolean, isToday: boolean, isPast: boolean) {
  if (isTarget) return "bg-accent/8";
  if (isToday) return "bg-card/90";
  return isPast ? "" : "bg-card/40";
}

function ghostTone(task: WeekTask) {
  return task.goal_id
    ? "border-area/60 bg-[color-mix(in_oklch,var(--area)_16%,var(--color-card))]"
    : "border-ink/30 bg-card";
}

// "10:00–14:00 · 4h", or just the start for work without hours.
function rangeLabel(startMinutes: number, durationMinutes: number | null) {
  if (durationMinutes === null) {
    return minutesToTime(startMinutes);
  }
  return `${minutesToTime(startMinutes)}–${minutesToTime(startMinutes + durationMinutes)} · ${formatDuration(durationMinutes)}`;
}

function blockPlacement(task: WeekTask, column: number, columns: number): BlockPlacement {
  const top = (timeToMinutes(task.start_time ?? "00:00") / 60) * HOUR_HEIGHT;
  const length = ((task.duration_minutes ?? 30) / 60) * HOUR_HEIGHT;
  return {
    top,
    height: Math.max(MIN_BLOCK_HEIGHT, Math.min(length, DAY_HEIGHT - top) - 2),
    left: `calc(${(column / columns) * 100}% + 2px)`,
    width: `calc(${100 / columns}% - 5px)`,
  };
}

// Fit the title between the time row and the block's bottom edge.
function titleClamp(height: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: Math.max(1, Math.floor((height - 23) / 15)),
    overflow: "hidden",
  };
}

function taskArea(task: WeekTask, areaByGoalId: ReadonlyMap<string, Area>) {
  return task.goal_id ? areaByGoalId.get(task.goal_id) : undefined;
}

function taskSummary(task: WeekTask, area: Area | undefined) {
  const details = [task.title];
  if (area) details.push(area.name);
  if (task.parent) {
    const { done, total } = task.parent.step_progress;
    details.push(`a step of ${task.parent.title}`, `${done} of ${total} steps done`);
  }
  if (task.start_time) {
    details.push(task.end_time ? `${task.start_time} to ${task.end_time}` : task.start_time);
  }
  if (task.duration_minutes !== null) details.push(describeDuration(task.duration_minutes));
  if (task.rule_id) details.push("repeating");
  return details.join(", ");
}

function clampStart(minutes: number) {
  return Math.max(0, Math.min(LAST_START_MINUTES, minutes));
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function layoutTimedTasks(tasks: WeekTask[]) {
  const sorted = [...tasks].sort(
    (left, right) =>
      timeToMinutes(left.start_time ?? "00:00") -
      timeToMinutes(right.start_time ?? "00:00"),
  );
  const result: Array<{ task: WeekTask; column: number; columns: number }> = [];
  let active: Array<{ end: number; column: number }> = [];
  let group: Array<{ task: WeekTask; column: number }> = [];
  let groupColumns = 1;

  const finishGroup = () => {
    result.push(...group.map((item) => ({ ...item, columns: groupColumns })));
    group = [];
    groupColumns = 1;
  };

  for (const task of sorted) {
    const start = timeToMinutes(task.start_time ?? "00:00");
    active = active.filter((item) => item.end > start);
    if (active.length === 0 && group.length > 0) finishGroup();

    const usedColumns = new Set(active.map((item) => item.column));
    let column = 0;
    while (usedColumns.has(column)) column += 1;
    const end = start + (task.duration_minutes ?? 30);
    active.push({ end, column });
    group.push({ task, column });
    groupColumns = Math.max(groupColumns, active.length, column + 1);
  }
  if (group.length > 0) finishGroup();
  return result;
}

function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
