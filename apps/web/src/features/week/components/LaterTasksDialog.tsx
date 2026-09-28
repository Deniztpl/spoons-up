import { useId, useRef } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import type { WeekTask } from "../api/weekApi";

const dateFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function LaterTasksDialog({
  tasks,
  onSelect,
  onClose,
}: {
  tasks: WeekTask[];
  onSelect: (task: WeekTask) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={closeRef} onClose={onClose}>
      <header className="flex items-center gap-2.5">
        <h2 id={headingId} className="flex-1 text-lg font-semibold">
          Later tasks
        </h2>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close later tasks"
          className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <ul aria-label="Later tasks" className="-mt-1.5">
        {tasks.map((task) => (
          <li key={task.id} className="border-t border-line">
            <button
              type="button"
              className="grid w-full grid-cols-[118px_52px_minmax(0,1fr)] items-baseline gap-2.5 rounded-md py-[11px] text-left text-[13.5px] transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => onSelect(task)}
            >
              <span className="whitespace-nowrap text-ink-soft">
                {dateFormat.format(localDate(task.scheduled_date))}
              </span>
              <span className="whitespace-nowrap text-ink-soft tabular-nums">
                {task.start_time ?? "No time"}
              </span>
              <span className="min-w-0 break-words">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </ModalDialog>
  );
}

function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
