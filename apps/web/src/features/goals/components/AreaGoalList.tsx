import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { Requirement } from "../../results/api/resultsApi";
import { weekAmount } from "../../results/weekAmount";
import type { Goal } from "../api/goalsApi";

type AreaGoalListProps = {
  goals: Goal[];
  // This week's done and target by goal id; goals without a target are absent.
  weekResults: ReadonlyMap<string, Requirement>;
  onEdit: (goal: Goal) => void;
};

export function AreaGoalList({ goals, weekResults, onEdit }: AreaGoalListProps) {
  return (
    <ul aria-label="Goals" className="-mx-2 flex flex-col gap-1">
      {goals.map((goal) => {
        const result = weekResults.get(goal.id);
        const isDone = result !== undefined && result.done >= result.target;
        return (
          <li key={goal.id}>
            <button
              type="button"
              aria-label={`${goal.title}, goal${
                result ? `, ${result.done} of ${result.target} this week` : ""
              }`}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => onEdit(goal)}
            >
              <span
                aria-hidden="true"
                className={`grid size-4 shrink-0 place-items-center rounded-[5px] border-[1.5px] ${
                  isDone ? "border-area bg-area text-white" : "border-muted"
                }`}
              >
                {isDone ? <CheckIcon /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={`truncate text-[13.5px] ${isDone ? "text-ink-soft" : ""}`}>
                  {goal.title}
                </span>
                <span className="text-[11px] text-ink-soft">{goalSummary(goal)}</span>
              </span>
              <span
                aria-hidden={result ? "true" : undefined}
                className={`shrink-0 rounded-[5px] bg-area/12 px-[7px] py-[3px] text-area-strong ${
                  result
                    ? "text-[11px] font-semibold tabular-nums"
                    : "text-[10px] font-medium uppercase tracking-[0.06em]"
                }`}
              >
                {result ? weekAmount(result) : "Goal"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function goalSummary(goal: Goal) {
  if (goal.weekly_target === null) {
    return "No target";
  }
  return `${goal.weekly_target} ${goal.weekly_target === 1 ? "block" : "blocks"}/week`;
}
