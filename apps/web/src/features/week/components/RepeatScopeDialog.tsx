import { useId, useRef } from "react";

import { ModalDialog } from "../../../components/ui/ModalDialog";

type RepeatScopeDialogProps = {
  title: string;
  action: "change" | "delete";
  onOnlyThis: () => void;
  onAll: () => void;
  onCancel: () => void;
};

const copy = {
  change: {
    heading: (title: string) => `Change “${title}”?`,
    detail:
      "It repeats. Change only this one, or move every repeat of its schedule the same way from today on.",
  },
  delete: {
    heading: (title: string) => `Delete “${title}”?`,
    detail:
      "It repeats. Delete only this one, or end its schedule and remove its open repeats from this week on.",
  },
};

// Asks, as Notion Calendar does, whether a change to a repeating task is for this one or all.
// Enter picks Only this; Escape leaves everything as it was.
export function RepeatScopeDialog({
  title,
  action,
  onOnlyThis,
  onAll,
  onCancel,
}: RepeatScopeDialogProps) {
  const headingId = useId();
  const onlyThisRef = useRef<HTMLButtonElement>(null);
  const tone =
    action === "delete"
      ? "bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger"
      : "bg-accent text-white hover:bg-accent-strong focus-visible:outline-accent";

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={onlyThisRef} onClose={onCancel}>
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="break-words text-lg font-semibold">
          {copy[action].heading(title)}
        </h2>
        <p className="text-[13px] leading-5 text-ink-soft">{copy[action].detail}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          ref={onlyThisRef}
          type="button"
          className={`rounded-[9px] px-3.5 py-2 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ${tone}`}
          onClick={onOnlyThis}
        >
          Only this task
        </button>
        <button
          type="button"
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onAll}
        >
          All repeating
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className="rounded-[9px] px-3 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
}
