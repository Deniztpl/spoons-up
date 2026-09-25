import { AreaIcon } from "../../areas/components/AreaIcon";
import type { Habit } from "../api/habitsApi";

type AreaHabitListProps = {
  habits: Habit[];
  isLoading: boolean;
  loadError: string | null;
  onAdd: () => void;
  onEdit: (habit: Habit) => void;
};

const modeLabels: Record<Habit["mode"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

const addButtonClassName =
  "flex items-center justify-center gap-2 rounded-[9px] border border-dashed border-ink/20 p-2.5 text-[12.5px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AreaHabitList({
  habits,
  isLoading,
  loadError,
  onAdd,
  onEdit,
}: AreaHabitListProps) {
  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <p role="status" className="text-[13px] text-ink-soft">
          Loading habits…
        </p>
      ) : null}

      {loadError ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}

      {!isLoading && !loadError && habits.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-ink/18 bg-well px-5 py-9 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <AreaIcon />
          </div>
          <h3 className="mt-3 text-[13.5px] font-medium">Nothing here yet</h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-soft">
            This area is ready for its goals and habits.
          </p>
        </div>
      ) : null}

      {/* TODO(slice-3): list goals above habits. */}
      {habits.length > 0 ? (
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
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {/* TODO(slice-3): enable goal creation. */}
        <button
          type="button"
          disabled
          className={`${addButtonClassName} cursor-not-allowed text-muted`}
        >
          <span aria-hidden="true" className="size-2.5 rounded-[3px] border-[1.5px] border-current" />
          Add goal
          <span className="text-[9px] uppercase tracking-[0.07em]">Soon</span>
        </button>
        <button
          type="button"
          className={`${addButtonClassName} text-ink hover:bg-well`}
          onClick={onAdd}
        >
          <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-habit" />
          Add habit
        </button>
      </div>
    </div>
  );
}
