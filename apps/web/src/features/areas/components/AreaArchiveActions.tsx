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
    <div className="mt-8 rounded-2xl border border-stone-200 bg-ivory-50/70 p-6">
      <p className="text-sm leading-6 text-stone-600">
        Restore this area to make it active again, or delete it permanently.
      </p>
      {isConfirmingDelete ? (
        <div
          role="group"
          aria-label="Confirm permanent deletion"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-sm font-semibold text-red-900">
            Delete {areaName} permanently?
          </p>
          <p className="mt-1 text-sm text-red-700">This cannot be undone.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
              onClick={onDelete}
            >
              {isSaving ? "Deleting..." : "Delete permanently"}
            </button>
            <button
              type="button"
              disabled={isSaving}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700"
              onClick={onCancelDeleting}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isSaving}
            className="rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-800 disabled:cursor-wait disabled:opacity-60"
            onClick={onRestore}
          >
            {isSaving ? "Restoring..." : "Restore"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
            onClick={onStartDeleting}
          >
            Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}
