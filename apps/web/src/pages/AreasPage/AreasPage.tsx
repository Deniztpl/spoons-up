import { useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { AreaDetails } from "../../features/areas/components/AreaDetails/AreaDetails";
import { AreaIcon } from "../../features/areas/components/AreaIcon";
import { AreaList } from "../../features/areas/components/AreaList/AreaList";
import { useAreas } from "../../features/areas/hooks/useAreas";
import { AreaGoalList } from "../../features/goals/components/AreaGoalList";
import { GoalFormDialog } from "../../features/goals/components/GoalFormDialog";
import { useAreaGoals } from "../../features/goals/hooks/useAreaGoals";
import { AreaHabitList } from "../../features/habits/components/AreaHabitList";
import { HabitFormDialog } from "../../features/habits/components/HabitFormDialog";
import { useAreaHabits } from "../../features/habits/hooks/useAreaHabits";
import type { AreaResult } from "../../features/results/api/resultsApi";
import { AreaWeekProgress } from "../../features/results/components/AreaWeekProgress";
import { GrowthView } from "../../features/results/components/GrowthView";
import { useProgress } from "../../features/results/hooks/useProgress";

type AreaView = "active" | "archived" | "growth";

const addButtonClassName =
  "flex items-center justify-center gap-2 rounded-[9px] border border-dashed border-ink/20 p-2.5 text-[12.5px] font-medium text-ink transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AreasPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const areaState = useAreas();
  const progressState = useProgress();
  const [view, setView] = useState<AreaView>("active");
  const activeAreas = areaState.areas.filter((area) => area.archived_at === null);
  const archivedAreas = areaState.areas.filter((area) => area.archived_at !== null);
  // Keep selection within the current view.
  const selectedArea =
    areaState.selectedArea &&
    (view === "archived"
      ? areaState.selectedArea.archived_at !== null
      : areaState.selectedArea.archived_at === null)
      ? areaState.selectedArea
      : null;
  const activeAreaId =
    selectedArea && selectedArea.archived_at === null ? selectedArea.id : null;
  const areaGoals = useAreaGoals(activeAreaId, progressState.reload);
  const areaHabits = useAreaHabits(activeAreaId, progressState.reload);
  const goalDraft = areaGoals.draft;
  const habitDraft = areaHabits.draft;
  const isLoadingItems = areaGoals.isLoading || areaHabits.isLoading;
  const itemsError = areaGoals.loadError ?? areaHabits.loadError;
  const hasItems = areaGoals.goals.length > 0 || areaHabits.habits.length > 0;
  const selectedResult =
    activeAreaId !== null ? progressState.areasById?.get(activeAreaId) : undefined;

  const showView = (nextView: AreaView) => {
    const firstArea =
      nextView === "active" ? activeAreas[0] : nextView === "archived" ? archivedAreas[0] : null;
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
      // Archived areas are left out of this week's progress.
      progressState.reload();
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

            <button
              type="button"
              aria-pressed={view === "growth"}
              className={`flex items-center gap-[7px] rounded-[9px] border px-3.5 py-2 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                view === "growth"
                  ? "border-[#6f4f2c] bg-[linear-gradient(180deg,#8f6a42,#7c5a36)] text-white"
                  : "border-[rgb(155_122_79/0.45)] bg-[linear-gradient(180deg,#f7ecd9,#efdfc2)] text-[#6b4f2e] shadow-[0_1px_2px_rgb(107_79_46/0.15),inset_0_1px_0_rgb(255_255_255/0.5)] hover:brightness-[.98]"
              }`}
              onClick={() => showView("growth")}
            >
              <SproutIcon />
              Growth
            </button>
          </div>

          {view !== "growth" && progressState.loadError ? (
            <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {progressState.loadError}
            </p>
          ) : null}

          {view === "growth" ? (
            <GrowthView areas={activeAreas} />
          ) : (
            <AreaList
              areas={view === "archived" ? archivedAreas : activeAreas}
              view={view}
              progress={progressState.areasById}
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
          )}
        </div>

        {view !== "growth" ? (
          <AreaDetails
            area={selectedArea}
            view={view}
            goalCount={
              areaGoals.isLoading || areaGoals.loadError ? null : areaGoals.goals.length
            }
            habitCount={
              areaHabits.isLoading || areaHabits.loadError ? null : areaHabits.habits.length
            }
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
          >
            <div className="flex flex-col gap-4">
              {selectedResult ? <AreaWeekProgress result={selectedResult} /> : null}

              {isLoadingItems ? (
                <p role="status" className="text-[13px] text-ink-soft">
                  Loading goals and habits…
                </p>
              ) : null}

              {itemsError ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
                  {itemsError}
                </p>
              ) : null}

              {!isLoadingItems && !itemsError && !hasItems ? (
                <div className="rounded-[10px] border border-dashed border-ink/18 bg-well px-5 py-9 text-center">
                  <div className="mx-auto grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
                    <AreaIcon />
                  </div>
                  <h3 className="mt-3 text-[13.5px] font-medium">Nothing here yet</h3>
                  <p className="mt-1 text-[13px] leading-5 text-ink-soft">
                    This area is ready for its goals and habits.
                  </p>
                </div>
              ) : null}

              {hasItems ? (
                <div className="flex flex-col gap-1">
                  {areaGoals.goals.length > 0 ? (
                    <AreaGoalList
                      goals={areaGoals.goals}
                      weekResults={weekResults(selectedResult, "GOAL")}
                      onEdit={areaGoals.openEdit}
                    />
                  ) : null}
                  {areaHabits.habits.length > 0 ? (
                    <AreaHabitList
                      habits={areaHabits.habits}
                      weekResults={weekResults(selectedResult, "HABIT")}
                      onEdit={areaHabits.openEdit}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={addButtonClassName} onClick={areaGoals.openCreate}>
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-[3px] border-[1.5px] border-accent"
                  />
                  Add goal
                </button>
                <button type="button" className={addButtonClassName} onClick={areaHabits.openCreate}>
                  <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-habit" />
                  Add habit
                </button>
              </div>
            </div>
          </AreaDetails>
        ) : null}
      </div>

      {selectedArea && goalDraft ? (
        <GoalFormDialog
          areaName={selectedArea.name}
          areaOptions={null}
          draft={goalDraft}
          error={areaGoals.formError}
          isSaving={areaGoals.isSaving}
          isConfirmingDelete={areaGoals.isConfirmingDelete}
          onAreaChange={areaGoals.setAreaId}
          onTitleChange={areaGoals.setTitle}
          onWeeklyTargetChange={areaGoals.setWeeklyTarget}
          onRepeatChange={areaGoals.setRepeating}
          onAddRule={areaGoals.addRule}
          onRuleChange={areaGoals.changeRule}
          onRemoveRule={areaGoals.removeRule}
          onSubmit={() => void areaGoals.saveGoal()}
          onClose={areaGoals.closeForm}
          onStartDeleting={areaGoals.startDeleting}
          onCancelDeleting={areaGoals.cancelDeleting}
          onDelete={() => void areaGoals.deleteGoal()}
        />
      ) : null}

      {selectedArea && habitDraft ? (
        <HabitFormDialog
          areaName={selectedArea.name}
          isEditing={habitDraft.habitId !== null}
          savedTitle={habitDraft.savedTitle}
          title={habitDraft.title}
          mode={habitDraft.mode}
          error={areaHabits.formError}
          isSaving={areaHabits.isSaving}
          isConfirmingDelete={areaHabits.isConfirmingDelete}
          onTitleChange={areaHabits.setTitle}
          onModeChange={areaHabits.setMode}
          onSubmit={() => void areaHabits.saveHabit()}
          onClose={areaHabits.closeForm}
          onStartDeleting={areaHabits.startDeleting}
          onCancelDeleting={areaHabits.cancelDeleting}
          onDelete={() => void areaHabits.deleteHabit()}
        />
      ) : null}
    </AppLayout>
  );
}

function weekResults(result: AreaResult | undefined, refType: "GOAL" | "HABIT") {
  return new Map(
    result?.requirements
      .filter((item) => item.ref_type === refType)
      .map((item) => [item.ref_id, item]),
  );
}

function viewButtonClassName(isPressed: boolean) {
  return `min-w-[74px] rounded-[7px] px-3.5 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    isPressed ? "bg-card text-ink" : "text-ink-soft hover:text-ink"
  }`;
}

function SproutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-[13px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M8 14V7" />
      <path d="M8 9C8 6 5.5 4.5 3 4.5c0 2.8 2 4.5 5 4.5z" />
      <path d="M8 7.5c0-2.6 2.2-4.5 5-4.5 0 2.8-2 4.5-5 4.5z" />
    </svg>
  );
}
