import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { AreaList } from "../../features/areas/components/AreaList";
import { AreaPanel } from "../../features/areas/components/AreaPanel";
import { useAreas } from "../../features/areas/hooks/useAreas";

export function AreasPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const areaState = useAreas();

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-600">
            Goals &amp; Habits
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-stone-950 sm:text-4xl">
            Areas
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">
            Organize the parts of your life you want to give steady attention to.
          </p>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
          <AreaList
            areas={areaState.areas}
            selectedAreaId={areaState.selectedAreaId}
            isLoading={areaState.isLoading}
            isAdding={areaState.isAdding}
            isSaving={areaState.isSaving}
            newAreaName={areaState.newAreaName}
            error={areaState.createError}
            onSelect={areaState.selectArea}
            onStartAdding={areaState.startAdding}
            onCancelAdding={areaState.cancelAdding}
            onNameChange={areaState.setNewAreaName}
            onCreate={() => void areaState.createArea()}
          />

          <AreaPanel
            area={areaState.selectedArea}
            isLoading={areaState.isLoading}
            loadError={areaState.loadError}
            isRenaming={areaState.isRenaming}
            isSaving={areaState.isSaving}
            renameName={areaState.renameName}
            renameError={areaState.renameError}
            onStartRenaming={areaState.startRenaming}
            onCancelRenaming={areaState.cancelRenaming}
            onNameChange={areaState.setRenameName}
            onRename={() => void areaState.renameArea()}
          />
        </div>
      </div>
    </AppLayout>
  );
}
