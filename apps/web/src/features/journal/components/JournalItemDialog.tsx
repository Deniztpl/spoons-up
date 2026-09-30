import { type FormEvent, type RefObject, useEffect, useId, useRef } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import type { JournalItem, JournalStep } from "../api/journalApi";
import {
  isDueDateAllowed,
  isJournalDraftChanged,
  type JournalDetailAction,
  type JournalDraft,
  type UnsavedStep,
} from "../hooks/useJournalDetail";
import { type JournalPriority, priorityOptions, priorityTagClassName } from "../journalPriority";
import { JournalDeleteConfirmation } from "./JournalDeleteConfirmation";
import { JournalStepList } from "./JournalStepList";
import { OpenStepsConfirmation } from "./OpenStepsConfirmation";

type JournalItemDialogProps = {
  draft: JournalDraft;
  // The saved item once the Journal has it; null for a new item.
  item: JournalItem | null;
  today: string;
  unsavedSteps: UnsavedStep[];
  error: string | null;
  busyAction: JournalDetailAction | null;
  pendingStepIds: string[];
  confirming: "complete" | "delete" | null;
  // Where focus goes on close when the row that opened the detail has left the list.
  fallbackFocusRef: RefObject<HTMLElement | null>;
  onTitleChange: (title: string) => void;
  onDueDateChange: (dueDate: string) => void;
  onStartTimeChange: (startTime: string) => void;
  onPriorityChange: (priority: JournalPriority | "") => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onClose: () => void;
  onAddStep: (title: string) => boolean;
  onToggleStep: (step: JournalStep) => void;
  onDeleteStep: (step: JournalStep) => Promise<boolean>;
  onRemoveUnsavedStep: (key: number) => void;
  onRetrySteps: () => void;
  onComplete: (item: JournalItem) => void;
  onReopen: (item: JournalItem) => void;
  onConfirmCompletion: () => void;
  onStartDeleting: () => void;
  onCancelConfirmation: () => void;
  onDelete: () => void;
};

const dateFieldClassName =
  "rounded-[7px] border border-ink/14 bg-card px-2 py-[5px] text-[13px] outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";
const secondaryButtonClassName =
  "rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const footerClassName = "flex items-center gap-2 border-t border-line pt-3.5";

export function JournalItemDialog({
  draft,
  item,
  today,
  unsavedSteps,
  error,
  busyAction,
  pendingStepIds,
  confirming,
  fallbackFocusRef,
  onTitleChange,
  onDueDateChange,
  onStartTimeChange,
  onPriorityChange,
  onSubmit,
  onDiscard,
  onClose,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onRemoveUnsavedStep,
  onRetrySteps,
  onComplete,
  onReopen,
  onConfirmCompletion,
  onStartDeleting,
  onCancelConfirmation,
  onDelete,
}: JournalItemDialogProps) {
  const headingId = useId();
  const dueDateId = useId();
  const dueDateHintId = useId();
  const priorityLabelId = useId();
  const priorityName = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const shownConfirmation = useRef(confirming);
  // The new-item footer stays while its steps are saved after it.
  const isNew = draft.itemId === null || busyAction === "create";
  const isSaving = busyAction !== null;
  const isDone = item?.status === "DONE";
  const { fields } = draft;
  const dueDateAllowed = isDueDateAllowed(draft, today);
  const isChanged = isJournalDraftChanged(draft);
  const canSave = fields.title.trim() !== "" && dueDateAllowed && (isNew || isChanged);

  // Move focus into a confirmation, and back to the button that opened it.
  useEffect(() => {
    const previous = shownConfirmation.current;
    shownConfirmation.current = confirming;
    if (confirming !== null) {
      confirmationCancelRef.current?.focus();
    } else if (previous === "delete") {
      deleteButtonRef.current?.focus();
    } else if (previous === "complete") {
      doneButtonRef.current?.focus();
    }
  }, [confirming]);

  // A pressed button can leave the footer while its request runs; keep focus in the dialog.
  useEffect(() => {
    if (busyAction === null && document.activeElement === document.body) {
      titleRef.current?.focus();
    }
  }, [busyAction]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave && !isSaving) {
      onSubmit();
    }
  };

  return (
    <ModalDialog
      labelledBy={headingId}
      initialFocusRef={titleRef}
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      {/* Past due dates stay valid until changed, so the browser's own date checks are off. */}
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex items-start gap-2">
          <h2 id={headingId} className="sr-only">
            {isNew ? "New item" : draft.saved.title}
          </h2>
          <input
            ref={titleRef}
            aria-label="Title"
            value={fields.title}
            placeholder="Title"
            readOnly={isSaving}
            className={`-ml-1.5 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-[3px] text-[19px] font-semibold tracking-[-0.01em] outline-none transition placeholder:font-normal placeholder:text-ink-soft hover:border-ink/10 focus:border-accent focus:bg-card focus:ring-3 focus:ring-accent/15 ${
              isDone ? "text-ink-soft line-through" : "text-ink"
            }`}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <button
            type="button"
            aria-label="Close"
            disabled={isSaving}
            className="-mr-1.5 grid size-[30px] shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
            onClick={onClose}
          >
            <CloseIcon className="size-[18px]" />
          </button>
        </div>

        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-t border-line pt-3.5">
          <label htmlFor={dueDateId} className="text-xs text-ink-soft">
            Due date
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={dueDateRef}
              id={dueDateId}
              type="date"
              value={fields.dueDate}
              min={today}
              readOnly={isSaving}
              aria-invalid={!dueDateAllowed}
              aria-describedby={dueDateAllowed ? undefined : dueDateHintId}
              className={`${dateFieldClassName} ${
                fields.dueDate !== "" && fields.dueDate < today && !isDone
                  ? "text-danger"
                  : "text-ink"
              }`}
              onChange={(event) => onDueDateChange(event.target.value)}
            />
            <input
              type="time"
              aria-label="Time"
              value={fields.startTime}
              disabled={fields.dueDate === ""}
              readOnly={isSaving}
              className={`${dateFieldClassName} w-[104px] text-ink disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-soft`}
              onChange={(event) => onStartTimeChange(event.target.value)}
            />
            {fields.dueDate !== "" ? (
              <button
                type="button"
                aria-label="Remove due date"
                disabled={isSaving}
                className="grid size-7 place-items-center rounded-md text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                onClick={() => {
                  // This button leaves with the date, so focus returns to the date field.
                  dueDateRef.current?.focus();
                  onDueDateChange("");
                }}
              >
                <CloseIcon className="size-4" />
              </button>
            ) : null}
          </div>
          {!dueDateAllowed ? (
            <p id={dueDateHintId} className="col-start-2 text-xs text-danger">
              Choose today or a later date.
            </p>
          ) : null}

          <span id={priorityLabelId} className="mt-1.5 text-xs text-ink-soft">
            Priority
          </span>
          <div
            role="radiogroup"
            aria-labelledby={priorityLabelId}
            className="mt-1.5 flex flex-wrap gap-1.5"
          >
            {[{ value: "" as const, label: "None", className: "bg-well text-ink" }, ...priorityOptions].map(
              (option) => {
                const isChosen = fields.priority === option.value;
                return (
                  <label key={option.value || "none"}>
                    <input
                      type="radio"
                      name={priorityName}
                      value={option.value}
                      checked={isChosen}
                      disabled={isSaving}
                      className="peer sr-only"
                      onChange={() => onPriorityChange(option.value)}
                    />
                    <span
                      className={`${priorityTagClassName} cursor-pointer border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                        isChosen
                          ? `${option.className} border-current/25`
                          : "border-ink/14 bg-card text-ink-soft hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </span>
                  </label>
                );
              },
            )}
          </div>
        </div>

        <JournalStepList
          steps={item?.steps ?? []}
          unsavedSteps={unsavedSteps}
          pendingStepIds={pendingStepIds}
          isDisabled={busyAction === "create" || busyAction === "delete"}
          onAdd={onAddStep}
          onToggle={onToggleStep}
          onDelete={onDeleteStep}
          onRemoveUnsaved={onRemoveUnsavedStep}
          onRetry={onRetrySteps}
        />

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {/* Each footer has its own key, so a pressed button is never reused as another action. */}
        {isNew ? (
          <div key="new" className={footerClassName}>
            <span className="flex-1" />
            <button type="button" disabled={isSaving} className={secondaryButtonClassName} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || isSaving}
              className={primaryButtonClassName(canSave)}
            >
              {busyAction === "create" ? "Adding…" : "Add"}
            </button>
          </div>
        ) : confirming === "delete" ? (
          <JournalDeleteConfirmation
            itemTitle={draft.saved.title}
            stepCount={item?.progress.total ?? 0}
            isDeleting={busyAction === "delete"}
            cancelButtonRef={confirmationCancelRef}
            onCancel={onCancelConfirmation}
            onDelete={onDelete}
          />
        ) : confirming === "complete" && item ? (
          <OpenStepsConfirmation
            openCount={item.progress.total - item.progress.done}
            isSaving={busyAction === "complete"}
            cancelButtonRef={confirmationCancelRef}
            onCancel={onCancelConfirmation}
            onConfirm={onConfirmCompletion}
          />
        ) : isChanged ? (
          <div key="changed" className={footerClassName}>
            <span className="flex-1" />
            <button
              type="button"
              disabled={isSaving}
              className={secondaryButtonClassName}
              onClick={() => {
                // This footer leaves with the changes, so focus returns to the title.
                titleRef.current?.focus();
                onDiscard();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave || isSaving}
              className={primaryButtonClassName(canSave)}
            >
              {busyAction === "save" ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div key="saved" className={footerClassName}>
            <button
              ref={deleteButtonRef}
              type="button"
              disabled={isSaving}
              className="-ml-1.5 rounded-lg px-1.5 py-2 text-[13px] font-medium text-danger transition hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
              onClick={onStartDeleting}
            >
              Delete
            </button>
            <span className="flex-1" />
            {item ? (
              <button
                ref={doneButtonRef}
                type="button"
                disabled={isSaving}
                className={isDone ? secondaryButtonClassName : primaryButtonClassName(true)}
                onClick={() => (isDone ? onReopen(item) : onComplete(item))}
              >
                {busyAction === "complete"
                  ? "Completing…"
                  : busyAction === "reopen"
                    ? "Reopening…"
                    : isDone
                      ? "Reopen"
                      : "Complete"}
              </button>
            ) : null}
          </div>
        )}
      </form>
    </ModalDialog>
  );
}

function primaryButtonClassName(isEnabled: boolean) {
  return `rounded-[9px] px-4 py-[9px] text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    isEnabled
      ? "bg-accent text-white hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
      : "cursor-not-allowed bg-well text-ink-soft"
  }`;
}
