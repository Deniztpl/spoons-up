import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { WeekResponse, WeekTask } from "../api/weekApi";

const HOUR_HEIGHT = 64;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
// Short enough to fit a one-line title, tall enough to click.
const MIN_BLOCK_HEIGHT = 18;
// Blocks at least this tall show a time row above the title.
const TALL_BLOCK_HEIGHT = 40;
// Blocks of 90 minutes or more also name their area under the title.
const AREA_LABEL_BLOCK_HEIGHT = 94;
const LAST_START_MINUTES = 23 * 60 + 45;
const TASK_DRAG_TYPE = "application/x-spoons-up-task";
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
  onCreate: (defaults: { scheduledDate: string; startTime?: string }) => void;
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
  onMove: (task: WeekTask, scheduledDate: string, startTime: string | null) => void;
};

type BlockPlacement = {
  top: number;
  height: number;
  left: string;
  width: string;
};

export function WeekCalendar({
  week,
  todayDate,
  areaByGoalId,
  pendingTaskIds,
  onCreate,
  onEdit,
  onToggle,
  onMove,
}: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const taskById = useMemo(
    () =>
      new Map(
        week.days.flatMap((day) => day.tasks.map((task) => [task.id, task] as const)),
      ),
    [week.days],
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

  const selectedDay =
    week.days.find((day) => day.date === selectedDate) ?? week.days[0];
  const selectedDoneCount =
    selectedDay?.tasks.filter((task) => task.status === "DONE").length ?? 0;

  function moveFromDrop(event: DragEvent<HTMLElement>, scheduledDate: string, startTime: string | null) {
    const payload = readDragPayload(event);
    if (!payload) return;
    const task = taskById.get(payload.taskId);
    if (task) onMove(task, scheduledDate, startTime);
  }

  return (
    <>
      <div ref={scrollRef} className="hidden min-h-0 flex-1 overflow-y-auto pb-6 md:block">
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
                <UntimedDropZone
                  key={day.date}
                  date={day.date}
                  isToday={day.date === todayDate}
                  isPast={day.date < todayDate}
                  tasks={day.tasks.filter((task) => task.start_time === null)}
                  areaByGoalId={areaByGoalId}
                  pendingTaskIds={pendingTaskIds}
                  onEdit={onEdit}
                  onToggle={onToggle}
                  onDrop={(event) => moveFromDrop(event, day.date, null)}
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
                onCreate={onCreate}
                onEdit={onEdit}
                onToggle={onToggle}
                onDrop={(event, startTime) => moveFromDrop(event, day.date, startTime)}
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

function UntimedDropZone({
  date,
  isToday,
  isPast,
  tasks,
  areaByGoalId,
  pendingTaskIds,
  onEdit,
  onToggle,
  onDrop,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  tasks: WeekTask[];
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: Set<string>;
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const dropTarget = useDropTarget(!isPast, onDrop);

  return (
    <div
      role="group"
      aria-label={`Untimed tasks for ${date}`}
      className={`flex min-h-[30px] min-w-0 flex-col gap-1 border-l border-ink/10 py-1 pl-0.5 pr-[3px] ${columnBackground(
        dropTarget.isOver,
        isToday,
        isPast,
      )}`}
      {...dropTarget.handlers}
    >
      {tasks.map((task) => (
        <TaskBlock
          key={task.id}
          task={task}
          area={taskArea(task, areaByGoalId)}
          isPending={pendingTaskIds.has(task.id)}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ))}
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
  onCreate,
  onEdit,
  onToggle,
  onDrop,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  tasks: WeekTask[];
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: Set<string>;
  onCreate: WeekCalendarProps["onCreate"];
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, startTime: string) => void;
}) {
  const laidOutTasks = layoutTimedTasks(tasks);
  const dropTarget = useDropTarget(!isPast, (event) => {
    const payload = readDragPayload(event);
    if (!payload) return;
    const startMinutes = Math.round((pointerMinutes(event) - payload.offsetMinutes) / 15) * 15;
    onDrop(event, minutesToTime(clampStart(startMinutes)));
  });

  function handleCreate(event: MouseEvent<HTMLButtonElement>) {
    // A keyboard press has no pointer position, so it proposes the start of a working day.
    const fromKeyboard = event.detail === 0 && event.clientX === 0 && event.clientY === 0;
    onCreate({
      scheduledDate: date,
      startTime: fromKeyboard
        ? "09:00"
        : minutesToTime(clampStart(Math.floor(pointerMinutes(event) / 30) * 30)),
    });
  }

  return (
    <div
      className={`relative min-w-0 border-l border-ink/10 ${columnBackground(dropTarget.isOver, isToday, isPast)}`}
      style={hourLines}
      {...dropTarget.handlers}
    >
      {!isPast ? (
        <button
          type="button"
          aria-label={`Add a task on ${date}`}
          className="absolute inset-0 cursor-copy focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          onClick={handleCreate}
        />
      ) : null}
      {isToday ? <NowLine /> : null}
      {laidOutTasks.map(({ task, column, columns }) => (
        <TaskBlock
          key={task.id}
          task={task}
          area={taskArea(task, areaByGoalId)}
          placement={blockPlacement(task, column, columns)}
          isPending={pendingTaskIds.has(task.id)}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ))}
    </div>
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
  isPending,
  onEdit,
  onToggle,
}: {
  task: WeekTask;
  area: Area | undefined;
  placement?: BlockPlacement;
  isPending: boolean;
  onEdit: (task: WeekTask) => void;
  onToggle: (task: WeekTask) => void;
}) {
  const isDone = task.status === "DONE";
  const isTall = placement !== undefined && placement.height >= TALL_BLOCK_HEIGHT;
  const showsArea = area !== undefined && isTall && placement.height >= AREA_LABEL_BLOCK_HEIGHT;
  const titleClassName = `min-w-0 text-[12px] font-medium leading-[1.25] text-ink ${isDone ? "line-through" : ""}`;
  const badge =
    task.block_count !== null || task.rule_id !== null ? (
      <span
        aria-hidden="true"
        className={`ml-auto flex h-[15px] shrink-0 items-center gap-[3px] rounded-[5px] px-1 text-[9.5px] font-semibold text-white tabular-nums ${
          task.goal_id ? "bg-area-strong" : "bg-ink-soft"
        }`}
      >
        {task.rule_id !== null ? <RepeatIcon className="size-[9px]" /> : null}
        {task.block_count !== null ? `×${task.block_count === 0.5 ? "½" : task.block_count}` : null}
      </span>
    ) : null;

  return (
    <article
      draggable={!isPending}
      title={task.title}
      className={`${
        placement ? "absolute z-[2] hover:z-[3]" : "relative h-[22px] shrink-0"
      } overflow-hidden rounded-[7px] border shadow-[0_1px_2px_rgb(28_43_33/0.06)] transition-shadow hover:shadow-[0_4px_12px_rgb(28_43_33/0.14)] ${
        task.goal_id
          ? "border-area/38 bg-[color-mix(in_oklch,var(--area)_9%,var(--color-card))]"
          : "border-ink/16 bg-card"
      } ${areaColorClass(area)} ${isPending ? "cursor-wait opacity-60" : isDone ? "opacity-50" : ""}`}
      style={placement}
      onDragStart={(event) => startDragging(event, task, task.duration_minutes ?? 30)}
    >
      <button
        type="button"
        aria-label={taskSummary(task, area)}
        className={`absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
          isPending ? "cursor-wait" : "cursor-grab active:cursor-grabbing"
        }`}
        onClick={() => onEdit(task)}
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
              style={titleClamp(placement.height - (showsArea ? 15 : 0))}
            >
              {task.title}
            </span>
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
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${isDone ? "line-through" : ""}`}>
          {task.title}
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

// Lights a column or untimed cell while a task is dragged over it.
function useDropTarget(isEnabled: boolean, onDrop: (event: DragEvent<HTMLDivElement>) => void) {
  const [isOver, setIsOver] = useState(false);

  return {
    isOver,
    handlers: {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (!isEnabled) return;
        event.preventDefault();
        setIsOver(true);
      },
      onDragLeave: (event: DragEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) setIsOver(false);
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        setIsOver(false);
        if (!isEnabled) return;
        event.preventDefault();
        onDrop(event);
      },
    },
  };
}

function columnBackground(isDropTarget: boolean, isToday: boolean, isPast: boolean) {
  if (isDropTarget) return "bg-accent/8";
  if (isToday) return "bg-card/90";
  return isPast ? "" : "bg-card/40";
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
  if (task.start_time) {
    details.push(task.end_time ? `${task.start_time} to ${task.end_time}` : task.start_time);
  }
  if (task.block_count !== null) details.push(blockLabel(task.block_count));
  if (task.rule_id) details.push("repeating");
  return details.join(", ");
}

function startDragging(event: DragEvent<HTMLElement>, task: WeekTask, duration: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const relativeY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
  const offsetMinutes = Math.round(((relativeY / Math.max(bounds.height, 1)) * duration) / 15) * 15;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(TASK_DRAG_TYPE, JSON.stringify({ taskId: task.id, offsetMinutes }));
}

function readDragPayload(event: DragEvent<HTMLElement>) {
  try {
    const value = JSON.parse(event.dataTransfer.getData(TASK_DRAG_TYPE)) as unknown;
    if (
      value &&
      typeof value === "object" &&
      "taskId" in value &&
      "offsetMinutes" in value &&
      typeof value.taskId === "string" &&
      typeof value.offsetMinutes === "number"
    ) {
      return value as { taskId: string; offsetMinutes: number };
    }
  } catch {
    return null;
  }
  return null;
}

function pointerMinutes(event: MouseEvent<HTMLElement> | DragEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return ((event.clientY - bounds.top) / HOUR_HEIGHT) * 60;
}

function clampStart(minutes: number) {
  return Math.max(0, Math.min(LAST_START_MINUTES, minutes));
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(value: string) {
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function blockLabel(value: number) {
  return value === 0.5 ? "half a block" : `${value} block${value === 1 ? "" : "s"}`;
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
