import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { TodayHabit } from "../api/todayApi";

type TodayHabitListProps = {
  habits: TodayHabit[];
  pendingHabitIds: string[];
  onToggle: (habit: TodayHabit) => void;
};

export function TodayHabitList({ habits, pendingHabitIds, onToggle }: TodayHabitListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {habits.map((habit) => {
        const isPending = pendingHabitIds.includes(habit.id);
        return (
          <li key={habit.id}>
            <label
              className={`flex h-8 items-center gap-2.5 rounded-[10px] bg-habit/9 pl-[13px] pr-2 transition hover:brightness-[.985] ${
                isPending ? "cursor-wait" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={habit.done}
                disabled={isPending}
                className="peer sr-only"
                onChange={() => onToggle(habit)}
              />
              <span
                aria-hidden="true"
                className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-ink-soft text-white peer-checked:border-habit peer-checked:bg-habit peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
              >
                {habit.done ? <CheckIcon /> : null}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm font-medium ${
                  habit.done ? "text-ink-soft line-through" : "text-ink"
                }`}
              >
                {habit.title}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
