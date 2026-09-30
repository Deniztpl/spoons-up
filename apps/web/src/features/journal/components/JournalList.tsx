import { useEffect, useRef } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { JournalItem } from "../api/journalApi";
import { dueDescription, dueLabel } from "../journalDates";
import { priorityOption, priorityTagClassName } from "../journalPriority";

export type JournalView = "active" | "completed";

type JournalListProps = {
  items: JournalItem[];
  view: JournalView;
  // The user's local today, from the Journal response.
  today: string;
  pendingItemIds: string[];
  onToggle: (item: JournalItem) => void;
  onOpen: (item: JournalItem) => void;
};

const completedFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const completedWithYearFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function JournalList({
  items,
  view,
  today,
  pendingItemIds,
  onToggle,
  onOpen,
}: JournalListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const toggledRow = useRef<{ id: string; index: number } | null>(null);
  // Priorities get their own column at the end of the rows, kept only while some row has one.
  const showsPriority = items.some((item) => Boolean(item.priority));

  // When a checked row leaves this list, keep keyboard focus on the row that took its place.
  useEffect(() => {
    const toggled = toggledRow.current;
    if (!toggled || items.some((item) => item.id === toggled.id)) {
      return;
    }
    toggledRow.current = null;
    if (document.activeElement !== document.body) {
      return;
    }
    const checkboxes = listRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (checkboxes && checkboxes.length > 0) {
      checkboxes[Math.min(toggled.index, checkboxes.length - 1)]?.focus();
    }
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink/16 px-6 py-10 text-center text-[13px] text-ink-soft">
        {view === "active" ? "No open items." : "Nothing completed yet."}
      </p>
    );
  }

  return (
    <ul
      ref={listRef}
      aria-label={view === "active" ? "Active items" : "Completed items"}
      className="overflow-hidden rounded-xl border border-ink/10 bg-card shadow-[0_1px_2px_rgb(28_43_33/0.04)]"
    >
      {items.map((item, index) => {
        const isDone = item.status === "DONE";
        const isPending = pendingItemIds.includes(item.id);
        const isOverdue = view === "active" && item.due_date !== null && item.due_date < today;
        const when = whenLabel(item, view, today);
        const { done, total } = item.progress;
        const checkId = `journal-item-${item.id}-check`;
        const titleId = `journal-item-${item.id}-title`;
        const detailsId = `journal-item-${item.id}-details`;
        return (
          <li key={item.id} className="border-t border-line first:border-t-0">
            <div className="flex items-center gap-3 px-4 transition hover:bg-well">
              <label htmlFor={checkId} className={isPending ? "cursor-wait" : "cursor-pointer"}>
                <input
                  id={checkId}
                  type="checkbox"
                  checked={isDone}
                  disabled={isPending}
                  aria-labelledby={titleId}
                  aria-describedby={detailsId}
                  className="peer sr-only"
                  onChange={() => {
                    toggledRow.current = { id: item.id, index };
                    onToggle(item);
                  }}
                />
                <span
                  aria-hidden="true"
                  className="grid size-[17px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-ink-soft text-white peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                >
                  {isDone ? <CheckIcon /> : null}
                </span>
              </label>
              <button
                type="button"
                aria-labelledby={titleId}
                aria-describedby={detailsId}
                className="flex min-h-[50px] min-w-0 flex-1 flex-col justify-center gap-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-row sm:items-center sm:gap-3"
                onClick={() => onOpen(item)}
              >
                <span
                  id={titleId}
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isDone ? "text-ink-soft line-through" : "text-ink"
                  }`}
                >
                  {item.title}
                </span>
                {total > 0 || when || item.priority ? (
                  <span aria-hidden="true" className="flex shrink-0 items-center gap-3">
                    {total > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-[34px] overflow-hidden rounded-[3px] bg-track">
                          <span
                            className="block h-full bg-accent"
                            style={{ width: `${(done / total) * 100}%` }}
                          />
                        </span>
                        <span className="text-[11.5px] text-ink-soft tabular-nums">
                          {done}/{total}
                        </span>
                      </span>
                    ) : null}
                    {when ? (
                      <span
                        className={`whitespace-nowrap text-xs tabular-nums sm:min-w-[84px] sm:text-right ${
                          isOverdue ? "text-danger" : "text-ink-soft"
                        }`}
                      >
                        {when}
                      </span>
                    ) : null}
                    {item.priority ? (
                      <span className="flex shrink-0 sm:w-[62px]">
                        <span
                          className={`${priorityTagClassName} ${priorityOption(item.priority).className} ${
                            isDone ? "opacity-60" : ""
                          }`}
                        >
                          {priorityOption(item.priority).label}
                        </span>
                      </span>
                    ) : showsPriority ? (
                      <span className="hidden w-[62px] shrink-0 sm:block" />
                    ) : null}
                  </span>
                ) : null}
                <span id={detailsId} className="sr-only">
                  {itemDetails(item, view, today)}
                </span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Active rows show the due date, never the possibly different scheduled day; completed rows show when.
function whenLabel(item: JournalItem, view: JournalView, today: string) {
  if (view === "completed") {
    return item.completed_at ? completedLabel(item.completed_at, today) : "";
  }
  return item.due_date ? dueLabel(item.due_date, item.start_time, today) : "";
}

function itemDetails(item: JournalItem, view: JournalView, today: string) {
  const parts: string[] = [];
  if (item.priority) {
    parts.push(`${priorityOption(item.priority).label} priority`);
  }
  if (view === "completed") {
    if (item.completed_at) {
      parts.push(`Completed ${completedLabel(item.completed_at, today)}`);
    }
  } else {
    parts.push(
      item.due_date ? dueDescription(item.due_date, item.start_time, today) : "No due date",
    );
  }
  if (item.progress.total > 0) {
    parts.push(`${item.progress.done} of ${item.progress.total} steps done`);
  }
  return parts.join(", ");
}

function completedLabel(completedAt: string, today: string) {
  const date = new Date(completedAt);
  const format =
    String(date.getFullYear()) === today.slice(0, 4) ? completedFormat : completedWithYearFormat;
  return format.format(date);
}
