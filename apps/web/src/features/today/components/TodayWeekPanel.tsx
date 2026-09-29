import { useId } from "react";

import type { AreaResult } from "../../results/api/resultsApi";

type TodayWeekPanelProps = {
  // Areas with something to measure this week; null while loading.
  areas: AreaResult[] | null;
  loadError: string | null;
};

export function TodayWeekPanel({ areas, loadError }: TodayWeekPanelProps) {
  const headingId = useId();
  const doneCount = areas?.reduce((sum, area) => sum + metCount(area), 0) ?? 0;
  const totalCount = areas?.reduce((sum, area) => sum + area.requirements.length, 0) ?? 0;

  return (
    <aside
      aria-labelledby={headingId}
      className="w-full shrink-0 border-t border-line bg-card px-4 py-7 sm:px-8 md:w-[clamp(184px,20%,224px)] md:border-l md:border-t-0 md:px-[18px] md:pb-[22px] md:pt-[30px]"
    >
      <div className="flex items-baseline gap-2.5">
        <h2 id={headingId} className="flex-1 text-[15px] font-semibold">
          This week
        </h2>
        {areas && areas.length > 0 ? (
          <span className="text-[11px] text-ink-soft tabular-nums">
            {doneCount}/{totalCount}
            <span className="sr-only"> done</span>
          </span>
        ) : null}
      </div>

      {loadError ? <p className="mt-3.5 text-[12px] leading-5 text-ink-soft">{loadError}</p> : null}

      {areas && areas.length === 0 ? (
        <p className="mt-3.5 text-[12px] leading-5 text-ink-soft">
          Areas with goals or habits show their week here.
        </p>
      ) : null}

      {areas && areas.length > 0 ? (
        <ul aria-label="Areas this week" className="mt-3.5 grid grid-cols-2 gap-1.5">
          {areas.map((area) => {
            const met = metCount(area);
            const isComplete = met === area.requirements.length;
            return (
              <li
                key={area.area_id}
                className={`flex min-w-0 flex-col gap-[3px] rounded-[7px] border px-2.5 py-[9px] ${
                  isComplete ? "border-accent/25 bg-accent/8" : "border-ink/8 bg-well"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`text-base font-semibold leading-none tabular-nums ${
                    isComplete ? "text-accent" : "text-ink"
                  }`}
                >
                  {met}/{area.requirements.length}
                </span>
                <span className="truncate text-[10.5px] text-ink-soft">{area.name}</span>
                <span className="sr-only">
                  {met} of {area.requirements.length} done
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </aside>
  );
}

function metCount(area: AreaResult) {
  return area.requirements.filter((item) => item.done >= item.target).length;
}
