import { useRef, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { JournalItemDialog } from "../../features/journal/components/JournalItemDialog";
import { JournalList, type JournalView } from "../../features/journal/components/JournalList";
import { OpenStepsDialog } from "../../features/journal/components/OpenStepsDialog";
import { useJournal } from "../../features/journal/hooks/useJournal";
import { useJournalDetail } from "../../features/journal/hooks/useJournalDetail";

export function JournalPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const journalState = useJournal();
  const detail = useJournalDetail({ onChange: journalState.reload });
  const [view, setView] = useState<JournalView>("active");
  const newItemButtonRef = useRef<HTMLButtonElement>(null);
  const { journal, confirmingItem } = journalState;
  const { draft } = detail;
  // The detail follows its item between the two lists.
  const detailItem =
    journal && draft?.itemId
      ? ([...journal.active, ...journal.completed].find((item) => item.id === draft.itemId) ??
        null)
      : null;
  const views: { value: JournalView; label: string; count: number | undefined }[] = [
    { value: "active", label: "Active", count: journal?.active.length },
    { value: "completed", label: "Completed", count: journal?.completed.length },
  ];

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-1 justify-center px-4 py-6 sm:px-8 sm:py-8 lg:px-[34px] lg:pt-[34px]">
        <div className="flex w-full max-w-[680px] flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
            <h1 className="mr-auto text-[32px] font-semibold leading-tight tracking-[-0.02em]">
              Journal
            </h1>

            <div
              role="group"
              aria-label="Journal lists"
              className="flex gap-[3px] rounded-[9px] bg-well p-[3px] text-[12.5px] font-medium"
            >
              {views.map((option) => {
                const isPressed = view === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isPressed}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      isPressed
                        ? "bg-card text-ink shadow-[0_1px_2px_rgb(28_43_33/0.08)]"
                        : "text-ink-soft hover:text-ink"
                    }`}
                    onClick={() => setView(option.value)}
                  >
                    {option.label}
                    {option.count !== undefined ? (
                      <>
                        {" "}
                        <span className="text-[11px] text-ink-soft tabular-nums">{option.count}</span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              ref={newItemButtonRef}
              type="button"
              disabled={!journal}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                setView("active");
                detail.openNew();
              }}
            >
              <span aria-hidden="true">+</span>
              New item
            </button>
          </div>

          {journalState.isLoading ? (
            <p role="status" className="text-ink-soft">
              Loading journal…
            </p>
          ) : null}

          {journalState.loadError ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-danger">
              {journalState.loadError}
            </p>
          ) : null}

          {journalState.actionError ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {journalState.actionError}
            </p>
          ) : null}

          {journal ? (
            <JournalList
              key={view}
              items={view === "active" ? journal.active : journal.completed}
              view={view}
              today={journal.today}
              pendingItemIds={journalState.pendingItemIds}
              onToggle={journalState.toggleItem}
              onOpen={detail.openItem}
            />
          ) : null}
        </div>
      </div>

      {confirmingItem ? (
        <OpenStepsDialog
          item={confirmingItem}
          onCancel={journalState.cancelCompletion}
          onConfirm={journalState.confirmCompletion}
        />
      ) : null}

      {draft && journal ? (
        <JournalItemDialog
          draft={draft}
          item={detailItem}
          today={journal.today}
          unsavedSteps={detail.unsavedSteps}
          error={detail.error}
          busyAction={detail.busyAction}
          pendingStepIds={detail.pendingStepIds}
          confirming={detail.confirming}
          fallbackFocusRef={newItemButtonRef}
          onTitleChange={detail.setTitle}
          onDueDateChange={detail.setDueDate}
          onStartTimeChange={detail.setStartTime}
          onSubmit={() => void detail.save()}
          onDiscard={detail.discardChanges}
          onClose={detail.close}
          onAddStep={detail.addStep}
          onToggleStep={(step) => void detail.toggleStep(step)}
          onDeleteStep={detail.deleteStep}
          onRemoveUnsavedStep={detail.removeUnsavedStep}
          onRetrySteps={detail.retrySteps}
          onComplete={detail.requestCompletion}
          onReopen={detail.reopen}
          onConfirmCompletion={detail.confirmCompletion}
          onStartDeleting={detail.startDeleting}
          onCancelConfirmation={detail.cancelConfirmation}
          onDelete={() => void detail.deleteItem()}
        />
      ) : null}
    </AppLayout>
  );
}
