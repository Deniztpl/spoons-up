type TaskDeleteConfirmationProps = {
  taskTitle: string;
  isGoalLinked: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function TaskDeleteConfirmation({
  taskTitle,
  isGoalLinked,
  isSaving,
  onCancel,
  onDelete,
}: TaskDeleteConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm task deletion"
      className="rounded-[10px] border border-danger/25 bg-danger-soft p-4"
    >
      <p className="text-[13.5px] font-semibold text-ink">Delete “{taskTitle}”?</p>
      <p className="mt-1 text-[13px] leading-5 text-danger">
        {isGoalLinked
          ? "Only this task will be removed. Its goal and any repeating schedule stay unchanged."
          : "This standalone task will be permanently deleted."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] bg-danger px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isSaving ? "Deleting…" : "Delete task"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
