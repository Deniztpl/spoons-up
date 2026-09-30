import { useId, useRef } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";

export type NewTaskKind = "goal" | "journal";

type NewTaskKindDialogProps = {
  scheduledDate: string;
  startTime?: string;
  onChoose: (kind: NewTaskKind) => void;
  onClose: () => void;
};

const dateFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const choiceClassName =
  "flex w-full items-center gap-3 rounded-[10px] border border-ink/12 bg-card px-3.5 py-3 text-left transition hover:border-accent/40 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Week asks which kind of task a slot or the add button is for before opening that form.
export function NewTaskKindDialog({
  scheduledDate,
  startTime,
  onChoose,
  onClose,
}: NewTaskKindDialogProps) {
  const headingId = useId();
  const goalTitleId = useId();
  const goalHintId = useId();
  const journalTitleId = useId();
  const journalHintId = useId();
  const goalButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={goalButtonRef} onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={headingId} className="text-lg font-semibold">
            Add a task
          </h2>
          <p className="text-[13px] text-ink-soft tabular-nums">
            {dateFormat.format(localDate(scheduledDate))}
            {startTime ? ` · ${startTime}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          className="grid size-[30px] place-items-center rounded-lg text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onClose}
        >
          <CloseIcon className="size-[18px]" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          ref={goalButtonRef}
          type="button"
          aria-labelledby={goalTitleId}
          aria-describedby={goalHintId}
          className={choiceClassName}
          onClick={() => onChoose("goal")}
        >
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-accent" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id={goalTitleId} className="text-sm font-medium text-ink">
              Goal task
            </span>
            <span id={goalHintId} className="text-xs text-ink-soft">
              Work toward a goal in one of your areas.
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-labelledby={journalTitleId}
          aria-describedby={journalHintId}
          className={choiceClassName}
          onClick={() => onChoose("journal")}
        >
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-[3px] border-[1.5px] border-accent"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id={journalTitleId} className="text-sm font-medium text-ink">
              Journal task
            </span>
            <span id={journalHintId} className="text-xs text-ink-soft">
              A new to-do, or open work from your Journal.
            </span>
          </span>
        </button>
      </div>
    </ModalDialog>
  );
}

// Avoid UTC shifts for date-only values.
function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
