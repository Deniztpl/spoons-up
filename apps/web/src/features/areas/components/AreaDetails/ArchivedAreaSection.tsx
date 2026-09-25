import { ArchivedAreaDeleteConfirmation } from "./ArchivedAreaDeleteConfirmation";

type ArchivedAreaSectionProps = {
  areaName: string;
  isSaving: boolean;
  isConfirmingDelete: boolean;
  onRestore: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

export function ArchivedAreaSection({
  areaName,
  isSaving,
  isConfirmingDelete,
  onRestore,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: ArchivedAreaSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] leading-6 text-ink-soft">
        Restore this area to make it active again, or delete it permanently.
      </p>
      {isConfirmingDelete ? (
        <ArchivedAreaDeleteConfirmation
          areaName={areaName}
          isSaving={isSaving}
          onCancel={onCancelDeleting}
          onDelete={onDelete}
        />
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
