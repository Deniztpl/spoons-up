import { useId } from "react";

import { formatHours } from "../../../lib/duration";
import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { WeekGoalHours } from "../api/weekApi";

type WeekHoursPanelProps = {
  id: string;
  goals: WeekGoalHours[];
  areaById: ReadonlyMap<string, Area>;
};

// Each goal's target for the shown week, split into done, planned and not planned hours.
export function WeekHoursPanel({ id, goals, areaById }: WeekHoursPanelProps) {
  const headingId = useId();

  return (
    <aside
      id={id}
      aria-labelledby={headingId}
      className="order-first mb-4 shrink-0 rounded-[12px] border border-line bg-card px-4 py-4 md:order-none md:mb-0 md:ml-5 md:w-[clamp(210px,24%,264px)] md:overflow-y-auto md:rounded-none md:border-y-0 md:border-r-0 md:pb-6 md:pl-5 md:pr-0 md:pt-1"
    >
      <h2 id={headingId} className="text-[15px] font-semibold">
        Hours
      </h2>

      {goals.length === 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-ink-soft">
          Goals with a weekly target show their hours here.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {groupByArea(goals).map(({ areaId, goals: areaGoals }) => {
            const area = areaById.get(areaId);
            return (
              <section
                key={areaId}
                aria-label={area?.name ?? "Goals"}
                className={`flex flex-col gap-3 ${areaColorClass(area)}`}
              >
                {area ? (
                  <h3 className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-area-strong">
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-area" />
                    <span className="truncate">{area.name}</span>
                  </h3>
                ) : null}
                <ul className="flex flex-col gap-3">
                  {areaGoals.map((goal) => (
                    <GoalHoursRow key={goal.goal_id} goal={goal} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function GoalHoursRow({ goal }: { goal: WeekGoalHours }) {
  const notPlanned = Math.max(goal.target - goal.done - goal.planned, 0);
  const extra = Math.max(goal.done + goal.planned - goal.target, 0);
  // Past the target the bar stretches to the hours placed, so the target stays readable.
  const scale = Math.max(goal.target, goal.done + goal.planned) || 1;

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{goal.title}</span>
        <span className="shrink-0 text-[11px] text-ink-soft tabular-nums">
          {formatHours(goal.target)}
          {extra > 0 ? <span className="ml-1 font-semibold text-area-strong">+{formatHours(extra)}</span> : null}
        </span>
      </div>
      <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-track">
        <span className="h-full bg-area" style={{ width: `${(goal.done / scale) * 100}%` }} />
        <span className="h-full bg-area/35" style={{ width: `${(goal.planned / scale) * 100}%` }} />
      </div>
      <div className="mt-0.5 grid grid-cols-3 gap-x-1.5">
        <HoursFigure hours={goal.done} label="done" swatchClassName="bg-area" />
        <HoursFigure hours={goal.planned} label="planned" swatchClassName="bg-area/35" />
        <HoursFigure hours={notPlanned} label="not planned" swatchClassName="bg-track" />
      </div>
    </li>
  );
}

// One part of the bar: its colour, its hours and what they are, in an equal column.
function HoursFigure({
  hours,
  label,
  swatchClassName,
}: {
  hours: number;
  label: string;
  swatchClassName: string;
}) {
  return (
    <p className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 text-[12px] font-medium leading-4 text-ink tabular-nums">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-[3px] ${swatchClassName}`} />
        {formatHours(hours)}
      </span>{" "}
      <span className="text-[11px] leading-4 text-ink-soft">{label}</span>
    </p>
  );
}

// The goals arrive ordered by area, so each area's goals sit together.
function groupByArea(goals: WeekGoalHours[]) {
  const groups: Array<{ areaId: string; goals: WeekGoalHours[] }> = [];
  for (const goal of goals) {
    const last = groups.at(-1);
    if (last?.areaId === goal.area_id) {
      last.goals.push(goal);
    } else {
      groups.push({ areaId: goal.area_id, goals: [goal] });
    }
  }
  return groups;
}
