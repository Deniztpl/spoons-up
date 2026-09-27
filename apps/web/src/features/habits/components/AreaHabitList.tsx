import type { Habit } from "../api/habitsApi";

type AreaHabitListProps = {
  habits: Habit[];
  onEdit: (habit: Habit) => void;
};

const modeLabels: Record<Habit["mode"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

export function AreaHabitList({ habits, onEdit }: AreaHabitListProps) {
  return (
    <ul aria-label="Habits" className="-mx-2 flex flex-col gap-1">
      {habits.map((habit) => (
        <li key={habit.id}>
          <button
            type="button"
            aria-label={`${habit.title}, ${modeLabels[habit.mode].toLowerCase()} habit`}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => onEdit(habit)}
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-habit" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-[13.5px]">{habit.title}</span>
              <span className="text-[11px] text-ink-soft">{modeLabels[habit.mode]}</span>
            </span>
            <span className="shrink-0 rounded-[5px] bg-habit/12 px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-habit-strong">
              Habit
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
