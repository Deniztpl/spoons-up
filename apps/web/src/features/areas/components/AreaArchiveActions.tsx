type AreaArchiveActionsProps = {
  areaName: string;
  isSaving: boolean;
  isConfirmingDelete: boolean;
  onRestore: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

export function AreaArchiveActions({
  areaName,
  isSaving,
  isConfirmingDelete,
  onRestore,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: AreaArchiveActionsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] leading-6 text-ink-soft">
        Restore this area to make it active again, or delete it permanently.
      </p>
      {isConfirmingDelete ? (
        <div
          role="group"
          aria-label="Confirm permanent deletion"
          className="rounded-[10px] border border-danger/25 bg-danger-soft p-4"
        >
          <p className="text-[13.5px] font-semibold text-ink">
            Delete {areaName} permanently?
          </p>
          <p className="mt-1 text-[13px] text-danger">This cannot be undone.</p>
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
              onClick={onCancelDeleting}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={isSaving}
            className="rounded-lg border border-ink/14 bg-card px-[13px] py-[7px] text-[12.5px] font-medium text-accent transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
            onClick={onRestore}
          >
            {isSaving ? "Restoring..." : "Restore"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="rounded-sm text-xs font-medium text-danger underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60"
            onClick={onStartDeleting}
          >
            Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}
