type ArchivedAreaDeleteConfirmationProps = {
  areaName: string;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: () => void;
};

export function ArchivedAreaDeleteConfirmation({
  areaName,
  isSaving,
  onCancel,
  onDelete,
}: ArchivedAreaDeleteConfirmationProps) {
  return (
    <div
      role="group"
      aria-label="Confirm permanent deletion"
      className="rounded-[10px] border border-danger/25 bg-danger-soft p-4"
    >
      <p className="text-[13.5px] font-semibold text-ink">
        Delete {areaName} permanently?
      </p>
      <p className="mt-1 text-[13px] leading-5 text-danger">
        Its habits and all of their check-off history will be permanently deleted. This
        can't be undone.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] bg-danger px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
          onClick={onDelete}
        >
          {isSaving ? "Deleting..." : "Delete permanently"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
