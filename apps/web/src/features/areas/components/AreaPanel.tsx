import type { Area } from "../api/areasApi";
import { AreaActionsMenu } from "./AreaActionsMenu";
import { AreaArchiveActions } from "./AreaArchiveActions";
import { AreaIcon } from "./AreaIcon";
import { AreaRenameForm } from "./AreaRenameForm";

type AreaPanelProps = {
  area: Area | null;
  view: "active" | "archived";
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

const panelClassName =
  "flex w-full shrink-0 flex-col gap-[18px] border-t border-line bg-card px-4 py-7 sm:px-8 md:w-[clamp(272px,32%,344px)] md:border-l md:border-t-0 md:px-[26px] md:pb-[26px] md:pt-[30px]";

export function AreaPanel({
  area,
  view,
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
      <section className={panelClassName}>
        <p role="status" className="text-ink-soft">
          Loading your areas…
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className={panelClassName}>
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-danger">
          {loadError}
        </p>
      </section>
    );
  }

  if (!area) {
    return (
      <section className={panelClassName}>
        <div>
          <h2 className="text-[22px] font-semibold leading-tight">
            {view === "archived" ? "No archived areas" : "Create your first area"}
          </h2>
          <p className="mt-2 leading-6 text-ink-soft">
            {view === "archived"
              ? "Areas you archive will appear here."
              : "Add an area from this page to begin."}
          </p>
        </div>
      </section>
    );
  }

  const isArchived = area.archived_at !== null;

  return (
    <section className={panelClassName}>
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
        <div className="flex items-center gap-2.5">
          <h2 className="min-w-0 flex-1 break-words text-[22px] font-semibold leading-tight">
            {area.name}
          </h2>
          {isArchived ? (
            <span className="shrink-0 rounded-[5px] bg-well px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-ink-soft">
              Archived
            </span>
          ) : (
            <AreaActionsMenu
              isSaving={isSaving}
              onRename={onStartRenaming}
              onArchive={onArchive}
            />
          )}
        </div>
      )}

      {actionError ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
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
        <div className="rounded-[10px] border border-dashed border-ink/18 bg-well px-5 py-9 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <AreaIcon />
          </div>
          <h3 className="mt-3 text-[13.5px] font-medium">Nothing here yet</h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-soft">
            This area is ready for its goals and habits.
          </p>
        </div>
      )}
    </section>
  );
}
