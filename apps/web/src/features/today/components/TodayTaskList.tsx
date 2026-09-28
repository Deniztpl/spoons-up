import type { CSSProperties } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { TodayTask } from "../api/todayApi";

type TodayTaskListProps = {
  tasks: TodayTask[];
  pendingTaskIds: string[];
  onToggle: (task: TodayTask) => void;
  onEdit: (task: TodayTask) => void;
};

// A task is as tall as its blocks: 72px per block, with the 8px gaps between them.
const blockHeight = 72;
const blockGap = 8;

export function TodayTaskList({
  tasks,
  pendingTaskIds,
  onToggle,
  onEdit,
}: TodayTaskListProps) {
  const totalBlocks = tasks.reduce((sum, task) => sum + visualBlocks(task.block_count), 0);
  const doneBlocks = leadingDoneBlocks(tasks);
  const ticks = Array.from({ length: Math.floor(totalBlocks) + 1 }, (_, block) => block);

  return (
    <div className="relative">
      {/* The rail sits in the gutter the page keeps left of its column. */}
      <div
        aria-hidden="true"
        className="absolute -left-[26px] top-0 w-3.5"
        style={{ height: stackHeight(totalBlocks) }}
      >
        <div className="absolute inset-y-0 left-1.5 w-px bg-track" />
        <div
          className="absolute left-1.5 top-0 w-px bg-accent"
          style={{ height: stackHeight(doneBlocks) }}
        />
        {ticks.map((block) => (
          <div
            key={block}
            className={`absolute left-0.5 h-px w-[9px] ${
              block <= doneBlocks ? "bg-accent" : "bg-muted-light"
            }`}
            style={{ top: block === 0 ? 0 : block * (blockHeight + blockGap) - blockGap / 2 }}
          />
        ))}
      </div>

      <ul aria-label="Tasks" className="flex flex-col gap-2">
        {tasks.map((task) => {
          const isDone = task.status === "DONE";
          const isPending = pendingTaskIds.includes(task.id);
          const blocks = visualBlocks(task.block_count);
          const isShort = blocks < 1;
          const height = stackHeight(blocks);
          const checkId = `task-${task.id}-check`;
          const titleId = `task-${task.id}-title`;
          const detailsId = `task-${task.id}-details`;
          return (
            <li
              key={task.id}
              className="overflow-hidden rounded-[10px] bg-card shadow-[0_1px_0_rgb(28_43_33/0.06),0_0_0_1px_rgb(28_43_33/0.07)]"
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
                    className="grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-ink-soft text-white peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
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
                    id={titleId}
                    className={`min-w-0 flex-1 text-sm font-medium leading-[1.35] ${
                      isShort ? "truncate" : "break-words text-pretty"
                    } ${isDone ? "text-ink-soft line-through" : "text-ink"}`}
                    style={isShort ? undefined : titleClamp(height)}
                  >
                    {task.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-[38px] shrink-0 text-right text-[11px] leading-[19px] text-ink-soft tabular-nums"
                  >
                    {task.start_time ?? ""}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-[26px] shrink-0 text-center text-[11px] font-medium leading-[19px] text-ink-soft tabular-nums"
                  >
                    {task.block_count === null
                      ? "—"
                      : task.block_count === 0.5
                        ? "½"
                        : `×${task.block_count}`}
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

function stackHeight(blocks: number) {
  return Math.max(0, Math.round(blocks * (blockHeight + blockGap) - blockGap));
}

// The rail fills through the tasks done in a row from the top of the day.
function leadingDoneBlocks(tasks: TodayTask[]) {
  let blocks = 0;
  for (const task of tasks) {
    if (task.status !== "DONE") {
      break;
    }
    blocks += visualBlocks(task.block_count);
  }
  return blocks;
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

function visualBlocks(count: number | null) {
  return count ?? 1;
}

function taskDetails(task: TodayTask) {
  const time = task.start_time
    ? task.end_time
      ? `${task.start_time} to ${task.end_time}`
      : `Starts at ${task.start_time}`
    : "No start time";
  return `${time}, ${blockCountText(task.block_count)}`;
}

function blockCountText(count: number | null) {
  if (count === null) {
    return "no block value";
  }
  if (count === 0.5) {
    return "half a block";
  }
  return count === 1 ? "1 block" : `${count} blocks`;
}
