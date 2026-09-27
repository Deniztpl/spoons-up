import { useEffect, useRef } from "react";

type ActiveAreaDeleteConfirmationProps = {
  id: string;
  areaName: string;
  goalCount: number | null;
  habitCount: number | null;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function ActiveAreaDeleteConfirmation({
  id,
  areaName,
  goalCount,
  habitCount,
  isSaving,
  onCancel,
  onDelete,
}: ActiveAreaDeleteConfirmationProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const items = lostItems(goalCount, habitCount);

  // Focus the safe action first.
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div
      id={id}
      role="group"
      aria-label="Confirm area deletion"
      className="absolute right-0 top-[38px] z-20 flex w-[250px] flex-col gap-[9px] rounded-[11px] border border-danger/30 bg-card p-3.5 shadow-[0_10px_26px_rgb(28_43_33/0.14)]"
    >
      <p className="text-[13.5px] font-medium">Delete “{areaName}”?</p>
      <p className="text-xs leading-[1.45] text-ink-soft">
        The following will be permanently deleted:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-[1.45] text-ink-soft">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-xs leading-[1.45] text-ink-soft">
        This can't be undone. Archive it instead if you might want it back.
      </p>
      <div className="flex justify-end gap-2 pt-0.5">
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={isSaving}
          className="rounded-lg border border-ink/14 bg-card px-3 py-[7px] text-[12.5px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-lg bg-danger px-3 py-[7px] text-[12.5px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isSaving ? "Deleting..." : "Delete area"}
        </button>
      </div>
    </div>
  );
}

function lostItems(goalCount: number | null, habitCount: number | null) {
  if (goalCount === null || habitCount === null) {
    return ["The area", "Everything in it and its history"];
  }

  const items = ["The area"];
  if (goalCount > 0) {
    items.push(itemWithHistory(goalCount, "goal", "history"));
  }
  if (habitCount > 0) {
    items.push(itemWithHistory(habitCount, "habit", "check-off history"));
  }
  return items;
}

function itemWithHistory(count: number, noun: string, history: string) {
  return `${countOf(count, noun)} and ${count === 1 ? "its" : "their"} ${history}`;
}

function countOf(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
