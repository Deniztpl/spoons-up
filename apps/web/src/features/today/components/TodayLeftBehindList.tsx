import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { LeftBehindItem } from "../api/todayApi";

type TodayLeftBehindListProps = {
  items: LeftBehindItem[];
  // The user's today, so an older year shows on the date.
  today: string;
  areaByGoalId: ReadonlyMap<string, Area>;
  pendingTaskIds: string[];
  onMove: (item: LeftBehindItem) => void;
};

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const dayWithYearFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Earlier work still open, oldest first; the only action is bringing it to today.
export function TodayLeftBehindList({
  items,
  today,
  areaByGoalId,
  pendingTaskIds,
  onMove,
}: TodayLeftBehindListProps) {
  return (
    <ul aria-label="Left behind" className="flex flex-col gap-2">
      {items.map((item) => {
        const area = item.goal_id ? areaByGoalId.get(item.goal_id) : undefined;
        const isPending = pendingTaskIds.includes(item.id);
        const titleId = `left-behind-${item.id}-title`;
        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 rounded-[10px] bg-card py-2.5 pl-[13px] pr-2.5 shadow-[0_1px_0_rgb(28_43_33/0.06),0_0_0_1px_rgb(28_43_33/0.07)] ${areaColorClass(area)}`}
          >
            <div className="min-w-0 flex-1">
              <p id={titleId} className="truncate text-sm font-medium text-ink">
                {item.title}
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-soft">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-area" />
                <span className="truncate">{item.source_label}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {dayLabel(item.scheduled_date, today)}
                  {item.start_time ? ` · ${item.start_time}` : ""}
                </span>
              </p>
            </div>
            <button
              type="button"
              aria-describedby={titleId}
              disabled={isPending}
              className="shrink-0 whitespace-nowrap rounded-lg border border-accent/35 bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
              onClick={() => onMove(item)}
            >
              {isPending ? "Moving…" : "Move to today"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function dayLabel(value: string, today: string) {
  const format = value.slice(0, 4) === today.slice(0, 4) ? dayFormat : dayWithYearFormat;
  return format.format(localDate(value));
}

// Avoid UTC shifts for date-only values.
function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
