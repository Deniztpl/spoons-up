import { useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { AreaList } from "../../features/areas/components/AreaList";
import { AreaPanel } from "../../features/areas/components/AreaPanel";
import { useAreas } from "../../features/areas/hooks/useAreas";

type AreaView = "active" | "archived";

function viewButtonClassName(isPressed: boolean) {
  return `min-w-[74px] rounded-[7px] px-3.5 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted ${
    isPressed ? "bg-card text-ink" : "text-ink-soft enabled:hover:text-ink"
  }`;
}

export function AreasPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const areaState = useAreas();
  const [view, setView] = useState<AreaView>("active");
  const activeAreas = areaState.areas.filter((area) => area.archived_at === null);
  const archivedAreas = areaState.areas.filter((area) => area.archived_at !== null);
  const selectedArea =
    areaState.selectedArea &&
    (view === "archived"
      ? areaState.selectedArea.archived_at !== null
      : areaState.selectedArea.archived_at === null)
      ? areaState.selectedArea
      : null;

  const showView = (nextView: AreaView) => {
    const firstArea = (nextView === "active" ? activeAreas : archivedAreas)[0];
    setView(nextView);
    if (nextView !== view && firstArea) {
      areaState.selectArea(firstArea.id);
    }
  };

  const startAdding = () => {
    showView("active");
    areaState.startAdding();
  };

  const archiveArea = async () => {
    if (await areaState.archiveArea()) {
      setView("archived");
    }
  };

  const restoreArea = async () => {
    if (await areaState.restoreArea()) {
      setView("active");
    }
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-[34px] lg:pb-10 lg:pt-[34px]">
          <div className="mb-[18px] flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em]">
              Areas
            </h1>

            <div
              role="group"
              aria-label="Area views"
              className="flex gap-[3px] rounded-[9px] bg-well p-[3px] text-[12.5px] font-medium"
            >
              <button
                type="button"
                aria-pressed={view === "active"}
                className={viewButtonClassName(view === "active")}
                onClick={() => showView("active")}
              >
                Active
              </button>
              <button type="button" disabled className={viewButtonClassName(false)}>
                History
                <span className="ml-1.5 text-[9px] uppercase tracking-[0.07em]">Soon</span>
              </button>
              <button
                type="button"
                aria-pressed={view === "archived"}
                className={viewButtonClassName(view === "archived")}
                onClick={() => showView("archived")}
              >
                Archived
                {archivedAreas.length > 0 ? (
                  <>
                    {" "}
                    <span aria-hidden="true">·</span> {archivedAreas.length}
                  </>
                ) : null}
              </button>
            </div>

            {!areaState.isAdding ? (
              <button
                type="button"
                className="rounded-[9px] bg-accent px-4 py-[9px] text-[13px] font-medium text-white transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={startAdding}
              >
                Add area
              </button>
            ) : null}
          </div>

          <AreaList
            areas={view === "archived" ? archivedAreas : activeAreas}
            view={view}
            selectedAreaId={areaState.selectedAreaId}
            isLoading={areaState.isLoading}
            isAdding={areaState.isAdding}
            isSaving={areaState.isSaving}
            newAreaName={areaState.newAreaName}
            error={areaState.createError}
            onSelect={areaState.selectArea}
            onCancelAdding={areaState.cancelAdding}
            onNameChange={areaState.setNewAreaName}
            onCreate={() => void areaState.createArea()}
          />
        </div>

        <AreaPanel
          area={selectedArea}
          view={view}
          isLoading={areaState.isLoading}
          loadError={areaState.loadError}
          isRenaming={areaState.isRenaming}
          isSaving={areaState.isSaving}
          renameName={areaState.renameName}
          renameError={areaState.renameError}
          actionError={areaState.actionError}
          isConfirmingDelete={areaState.isConfirmingDelete}
          onStartRenaming={areaState.startRenaming}
          onCancelRenaming={areaState.cancelRenaming}
          onNameChange={areaState.setRenameName}
          onRename={() => void areaState.renameArea()}
          onArchive={() => void archiveArea()}
          onRestore={() => void restoreArea()}
          onStartDeleting={areaState.startDeleting}
          onCancelDeleting={areaState.cancelDeleting}
          onDelete={() => void areaState.deleteArea()}
        />
      </div>
    </AppLayout>
  );
}
