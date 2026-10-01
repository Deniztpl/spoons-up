import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { Area } from "../../areas/api/areasApi";
import { areaColorClass } from "../../areas/areaColor";
import type { TodayHabit } from "../api/todayApi";

type TodayHabitListProps = {
  habits: TodayHabit[];
  areaById: ReadonlyMap<string, Area>;
  pendingHabitIds: string[];
  onToggle: (habit: TodayHabit) => void;
};

export function TodayHabitList({
  habits,
  areaById,
  pendingHabitIds,
  onToggle,
}: TodayHabitListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {habits.map((habit) => {
        const isPending = pendingHabitIds.includes(habit.id);
        return (
          <li key={habit.id} className={areaColorClass(areaById.get(habit.area_id))}>
            {/* Habits are outlined and striped in their area's colour, so they read apart from
                the flat tint of goal tasks. */}
            <label
              className={`flex h-8 items-center gap-2.5 rounded-[10px] border border-area/45 bg-card bg-[image:repeating-linear-gradient(135deg,color-mix(in_oklch,var(--area)_14%,transparent)_0_4px,transparent_4px_9px)] pl-[13px] pr-2 transition hover:brightness-[.985] ${
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
                className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-area bg-card text-area-strong peer-checked:border-area peer-checked:bg-area/20 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
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
