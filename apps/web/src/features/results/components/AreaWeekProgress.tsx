import type { AreaResult } from "../api/resultsApi";

const dayInitialFormat = new Intl.DateTimeFormat("en", { weekday: "narrow" });
const dayNameFormat = new Intl.DateTimeFormat("en", { weekday: "long" });

export function AreaWeekProgress({ result }: { result: AreaResult }) {
  const doneCount = result.requirements.filter((item) => item.done >= item.target).length;

  return (
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <ol aria-label="Daily habits this week" className="mb-[7px] flex gap-[5px]">
          {result.days.map((day) => (
            <li
              key={day.date}
              className={`h-[30px] flex-1 rounded-md ${day.done ? "bg-accent" : "bg-track"}`}
            >
              <span className="sr-only">
                {dayNameFormat.format(localDate(day.date))}:{" "}
                {day.done ? "every daily habit done" : "not done"}
              </span>
            </li>
          ))}
        </ol>
        <div
          aria-hidden="true"
          className="flex justify-between text-[10px] tracking-[0.04em] text-muted"
        >
          {result.days.map((day) => (
            <span key={day.date}>{dayInitialFormat.format(localDate(day.date))}</span>
          ))}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[26px] font-semibold leading-none tabular-nums">
          {result.percent}%
        </div>
        <div className="mt-1 text-[11px] text-ink-soft tabular-nums">
          {doneCount}/{result.requirements.length} done
        </div>
      </div>
    </div>
  );
}

function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
