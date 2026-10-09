import type { CSSProperties } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import { describeDuration, formatDuration } from "../../../lib/duration";
import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { TodayTask } from "../api/todayApi";

type TodayTaskListProps = {
  tasks: TodayTask[];
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: string[];
  onToggle: (task: TodayTask) => void;
  onEdit: (task: TodayTask) => void;
};

// A task is as tall as its hours: 72px an hour, with the 8px gaps between tasks.
const hourHeight = 72;
const taskGap = 8;
// A step's line naming its item, under the title.
const contextLineHeight = 17;

export function TodayTaskList({
  tasks,
  areaByGoalId,
  pendingTaskIds,
  onToggle,
  onEdit,
}: TodayTaskListProps) {
  const totalHours = tasks.reduce((sum, task) => sum + visualHours(task), 0);
  const doneHours = leadingDoneHours(tasks);
  const ticks = Array.from({ length: Math.floor(totalHours) + 1 }, (_, hour) => hour);

  return (
    <div className="relative">
      {/* The rail sits in the gutter the page keeps left of its column. */}
      <div
        aria-hidden="true"
        className="absolute -left-[26px] top-0 w-3.5"
        style={{ height: stackHeight(totalHours) }}
      >
        <div className="absolute inset-y-0 left-1.5 w-px bg-track" />
        <div
          className="absolute left-1.5 top-0 w-px bg-accent"
          style={{ height: stackHeight(doneHours) }}
        />
        {ticks.map((hour) => (
          <div
            key={hour}
            className={`absolute left-0.5 h-px w-[9px] ${
              hour <= doneHours ? "bg-accent" : "bg-muted-light"
            }`}
            style={{ top: hour === 0 ? 0 : hour * (hourHeight + taskGap) - taskGap / 2 }}
          />
        ))}
      </div>

      <ul aria-label="Tasks" className="flex flex-col gap-2">
        {tasks.map((task) => {
          const isDone = task.status === "DONE";
          const isPending = pendingTaskIds.includes(task.id);
          const hours = visualHours(task);
          const isShort = hours < 1;
          const height = stackHeight(hours);
          const checkId = `task-${task.id}-check`;
          const titleId = `task-${task.id}-title`;
          const detailsId = `task-${task.id}-details`;
          const area = task.goal_id ? areaByGoalId.get(task.goal_id) : undefined;
          // A step is a normal card; its item and that item's progress sit under the title.
          const parentLine = task.parent
            ? `${task.parent.title} · ${task.parent.step_progress.done}/${task.parent.step_progress.total}`
            : null;
          return (
            <li
              key={task.id}
              className={`overflow-hidden rounded-[10px] ${
                area
                  ? `border border-area/38 bg-[color-mix(in_oklch,var(--area)_9%,var(--color-card))] ${areaColorClass(area)}`
                  : "bg-card shadow-[0_1px_0_rgb(28_43_33/0.06),0_0_0_1px_rgb(28_43_33/0.07)]"
              }`}
              style={{ height }}
            >
              <div
                className={`flex h-full gap-2.5 pl-[13px] pr-2 transition hover:brightness-[.985] ${
                  isShort ? "items-center" : "items-start pt-3"
                }`}
              >
                <label
                  htmlFor={checkId}
                  className={isPending ? "cursor-wait" : "cursor-pointer"}
                >
                  <input
                    id={checkId}
                    type="checkbox"
                    checked={isDone}
                    disabled={isPending}
                    aria-labelledby={titleId}
                    aria-describedby={detailsId}
                    className="peer sr-only"
                    onChange={() => onToggle(task)}
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-ink-soft text-white peer-checked:border-area peer-checked:bg-area peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  >
                    {isDone ? <CheckIcon /> : null}
                  </span>
                </label>
                <button
                  type="button"
                  aria-labelledby={titleId}
                  aria-describedby={detailsId}
                  className="flex min-w-0 flex-1 gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => onEdit(task)}
                >
                  <span
                    className={`flex min-w-0 flex-1 ${
                      isShort ? "items-baseline gap-1.5" : "flex-col gap-0.5"
                    }`}
                  >
                    <span
                      id={titleId}
                      className={`min-w-0 text-sm font-medium leading-[1.35] ${
                        isShort ? "truncate" : "break-words text-pretty"
                      } ${isDone ? "text-ink-soft line-through" : "text-ink"}`}
                      style={
                        isShort
                          ? undefined
                          : titleClamp(parentLine ? height - contextLineHeight : height)
                      }
                    >
                      {task.title}
                    </span>
                    {parentLine ? (
                      <span
                        aria-hidden="true"
                        className="min-w-0 truncate text-[11.5px] leading-[1.35] text-ink-soft"
                      >
                        {parentLine}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-[38px] shrink-0 text-right text-[11px] leading-[19px] text-ink-soft tabular-nums"
                  >
                    {task.start_time ?? ""}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-[44px] shrink-0 text-right text-[11px] font-medium leading-[19px] text-ink-soft tabular-nums"
                  >
                    {task.duration_minutes === null ? "—" : formatDuration(task.duration_minutes)}
                  </span>
                  <span id={detailsId} className="sr-only">
                    {taskDetails(task)}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function stackHeight(hours: number) {
  return Math.max(0, Math.round(hours * (hourHeight + taskGap) - taskGap));
}

// The rail fills through the tasks done in a row from the top of the day.
function leadingDoneHours(tasks: TodayTask[]) {
  let hours = 0;
  for (const task of tasks) {
    if (task.status !== "DONE") {
      break;
    }
    hours += visualHours(task);
  }
  return hours;
}

// Fit the title between the 12px top padding and the card's bottom edge.
function titleClamp(height: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: Math.max(1, Math.floor((height - 30) / 19)),
    overflow: "hidden",
  };
}

// Cards run from half an hour to four hours tall; a Journal task without a duration takes one.
function visualHours(task: TodayTask) {
  if (task.duration_minutes === null) {
    return 1;
  }
  return Math.min(4, Math.max(0.5, task.duration_minutes / 60));
}

function taskDetails(task: TodayTask) {
  const time = task.start_time
    ? task.end_time
      ? `${task.start_time} to ${task.end_time}`
      : `Starts at ${task.start_time}`
    : "No start time";
  const duration =
    task.duration_minutes === null ? "no duration" : describeDuration(task.duration_minutes);
  const details = `${time}, ${duration}`;
  if (!task.parent) {
    return details;
  }
  const { done, total } = task.parent.step_progress;
  return `${details}, a step of ${task.parent.title}, ${done} of ${total} steps done`;
}
