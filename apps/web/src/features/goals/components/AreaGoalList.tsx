import type { Goal } from "../api/goalsApi";

type AreaGoalListProps = {
  goals: Goal[];
  onEdit: (goal: Goal) => void;
};

export function AreaGoalList({ goals, onEdit }: AreaGoalListProps) {
  return (
    <ul aria-label="Goals" className="-mx-2 flex flex-col gap-1">
      {goals.map((goal) => (
        <li key={goal.id}>
          <button
            type="button"
            aria-label={`${goal.title}, goal`}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onEdit(goal)}
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-accent" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-[13.5px]">{goal.title}</span>
              <span className="text-[11px] text-ink-soft">{goalSummary(goal)}</span>
            </span>
            <span className="shrink-0 rounded-[5px] bg-accent/12 px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-accent">
              Goal
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function goalSummary(goal: Goal) {
  if (goal.weekly_target === null) {
    return "No target";
  }
  return `${goal.weekly_target} ${goal.weekly_target === 1 ? "block" : "blocks"}/week`;
}
