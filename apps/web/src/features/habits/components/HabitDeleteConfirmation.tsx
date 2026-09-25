type HabitDeleteConfirmationProps = {
  habitTitle: string;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function HabitDeleteConfirmation({
  habitTitle,
  isSaving,
  onCancel,
  onDelete,
}: HabitDeleteConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm habit deletion"
      className="flex flex-col gap-2.5 rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-[13px]"
    >
      <p className="text-[13.5px] font-medium">Delete “{habitTitle}”?</p>
      <p className="text-xs leading-[1.45] text-ink-soft">
        This can't be undone. All of this habit's check-offs are deleted with it.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] bg-danger px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isSaving ? "Deleting..." : "Delete permanently"}
        </button>
      </div>
    </div>
  );
}
