import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { Requirement } from "../../results/api/resultsApi";
import { weekAmount } from "../../results/weekAmount";
import type { Habit } from "../api/habitsApi";

type AreaHabitListProps = {
  habits: Habit[];
  // This week's done and target by habit id.
  weekResults: ReadonlyMap<string, Requirement>;
  onEdit: (habit: Habit) => void;
};

const modeLabels: Record<Habit["mode"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

export function AreaHabitList({ habits, weekResults, onEdit }: AreaHabitListProps) {
  return (
    <ul aria-label="Habits" className="-mx-2 flex flex-col gap-1">
      {habits.map((habit) => {
        const result = weekResults.get(habit.id);
        const isDone = result !== undefined && result.done >= result.target;
        return (
          <li key={habit.id}>
            <button
              type="button"
              aria-label={`${habit.title}, ${modeLabels[habit.mode].toLowerCase()} habit${
                result ? `, ${result.done} of ${result.target} this week` : ""
              }`}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => onEdit(habit)}
            >
              <span
                aria-hidden="true"
                className={`grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] ${
                  isDone ? "border-habit bg-habit text-white" : "border-muted"
                }`}
              >
                {isDone ? <CheckIcon /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={`truncate text-[13.5px] ${isDone ? "text-ink-soft" : ""}`}>
                  {habit.title}
                </span>
                <span className="text-[11px] text-ink-soft">{modeLabels[habit.mode]}</span>
              </span>
              <span
                aria-hidden={result ? "true" : undefined}
                className={`shrink-0 rounded-[5px] bg-habit/12 px-[7px] py-[3px] text-habit-strong ${
                  result
                    ? "text-[11px] font-semibold tabular-nums"
                    : "text-[10px] font-medium uppercase tracking-[0.06em]"
                }`}
              >
                {result ? weekAmount(result) : "Habit"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
