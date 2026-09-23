import type { Area } from "../api/areasApi";
import { AreaArchiveActions } from "./AreaArchiveActions";
import { AreaIcon } from "./AreaIcon";
import { AreaRenameForm } from "./AreaRenameForm";

type AreaPanelProps = {
  area: Area | null;
  isLoading: boolean;
  loadError: string | null;
  isRenaming: boolean;
  isSaving: boolean;
  renameName: string;
  renameError: string | null;
  actionError: string | null;
  isConfirmingDelete: boolean;
  onStartRenaming: () => void;
  onCancelRenaming: () => void;
  onNameChange: (name: string) => void;
  onRename: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

export function AreaPanel({
  area,
  isLoading,
  loadError,
  isRenaming,
  isSaving,
  renameName,
  renameError,
  actionError,
  isConfirmingDelete,
  onStartRenaming,
  onCancelRenaming,
  onNameChange,
  onRename,
  onArchive,
  onRestore,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: AreaPanelProps) {
  if (isLoading) {
    return (
      <div role="status" className="rounded-[28px] bg-surface p-8 text-stone-500 shadow-panel">
        Loading your areas…
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-red-800">
        {loadError}
      </div>
    );
  }

  if (!area) {
    return (
      <section className="rounded-[28px] border border-white/80 bg-surface p-8 shadow-panel sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-600">
          Selected area
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-stone-950">
          Create your first area
        </h1>
        <p className="mt-3 max-w-xl leading-7 text-stone-600">
          Add an area from this page to begin.
        </p>
      </section>
    );
  }

  const isArchived = area.archived_at !== null;

  return (
    <section className="rounded-[28px] border border-white/80 bg-surface p-8 shadow-panel sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-600">
        {isArchived ? "Archived area" : "Selected area"}
      </p>
      {isRenaming ? (
        <AreaRenameForm
          name={renameName}
          error={renameError}
          isSaving={isSaving}
          onNameChange={onNameChange}
          onCancel={onCancelRenaming}
          onSubmit={onRename}
        />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-4xl">
            {area.name}
          </h1>
          {!isArchived ? (
            <>
              <button
                type="button"
                disabled={isSaving}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-sage-300 hover:text-sage-700 disabled:cursor-wait disabled:opacity-60"
                onClick={onStartRenaming}
              >
                Rename
              </button>
              <button
                type="button"
                disabled={isSaving}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-wait disabled:opacity-60"
                onClick={onArchive}
              >
                {isSaving ? "Archiving..." : "Archive"}
              </button>
            </>
          ) : null}
        </div>
      )}

      {actionError ? (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      {isArchived ? (
        <AreaArchiveActions
          areaName={area.name}
          isSaving={isSaving}
          isConfirmingDelete={isConfirmingDelete}
          onRestore={onRestore}
          onStartDeleting={onStartDeleting}
          onCancelDeleting={onCancelDeleting}
          onDelete={onDelete}
        />
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-ivory-50/70 px-6 py-14 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-sage-100 text-sage-700">
            <AreaIcon />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-stone-800">Nothing here yet</h2>
          <p className="mt-1 text-sm text-stone-500">
            This area is ready for its goals and habits.
          </p>
        </div>
      )}
    </section>
  );
}
