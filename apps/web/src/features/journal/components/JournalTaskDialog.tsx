import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import { TaskPlanFields } from "../../tasks/components/TaskPlanFields";
import type { JournalItem } from "../api/journalApi";
import {
  isJournalTaskDraftComplete,
  type JournalChoice,
  type JournalTaskDraft,
} from "../hooks/useJournalTaskForm";
import { dueDescription, dueLabel } from "../journalDates";

type JournalTaskDialogProps = {
  draft: JournalTaskDraft;
  dateMode: "fixed" | "editable";
  // The user's today: the earliest day work can go on, and where overdue starts.
  today: string;
  // Open Journal items, or null while they load.
  items: JournalItem[] | null;
  loadError: string | null;
  error: string | null;
  isSaving: boolean;
  onChoose: (choice: JournalChoice | null) => void;
  onNewTitleChange: (title: string) => void;
  onScheduledDateChange: (scheduledDate: string) => void;
  onStartTimeChange: (startTime: string) => void;
  onDurationChange: (durationMinutes: string) => void;
  onBlockCountChange: (blockCount: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

type ChoiceView = "list" | "new" | "steps" | "chosen";

const shortListLength = 5;
const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const fieldClassName =
  "w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";
const rowClassName =
  "flex w-full items-center gap-2.5 rounded-[7px] px-1.5 py-2 text-left transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondaryButtonClassName =
  "rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

export function JournalTaskDialog({
  draft,
  dateMode,
  today,
  items,
  loadError,
  error,
  isSaving,
  onChoose,
  onNewTitleChange,
  onScheduledDateChange,
  onStartTimeChange,
  onDurationChange,
  onBlockCountChange,
  onSubmit,
  onClose,
}: JournalTaskDialogProps) {
  const headingId = useId();
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [openedItemId, setOpenedItemId] = useState<string | null>(null);
  const [showsAll, setShowsAll] = useState(false);
  // The item whose steps were just left, so its row takes focus again.
  const leftItemId = useRef<string | null>(null);
  const { choice } = draft;
  const rows = items ? plannableItems(items, draft.scheduledDate) : [];
  const shownRows = showsAll ? rows : rows.slice(0, shortListLength);
  const openedItem = rows.find((item) => item.id === openedItemId) ?? null;
  const view: ChoiceView =
    choice?.kind === "new" ? "new" : choice ? "chosen" : openedItem ? "steps" : "list";
  const shownView = useRef(view);
  const canSave = isJournalTaskDraftComplete(draft);
  const submitLabel =
    choice && choice.kind !== "new" ? (dateMode === "fixed" ? "Add to today" : "Plan") : "Add";

  // The part the user acted on is replaced, so focus moves to the part that took its place.
  useEffect(() => {
    const previous = shownView.current;
    shownView.current = view;
    if (previous === view || document.activeElement !== document.body) {
      return;
    }
    if (view === "new") {
      newTitleRef.current?.focus();
    } else if (view === "chosen") {
      changeButtonRef.current?.focus();
    } else if (view === "steps") {
      backButtonRef.current?.focus();
    } else if (previous === "steps" && leftItemId.current) {
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-item-id="${leftItemId.current}"]`)
        ?.focus();
    } else {
      newButtonRef.current?.focus();
    }
  }, [view]);

  // Show all leaves with its button; the first row it revealed takes focus.
  useEffect(() => {
    if (showsAll && document.activeElement === document.body) {
      listRef.current?.querySelectorAll("button")[shortListLength]?.focus();
    }
  }, [showsAll]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave && !isSaving) {
      onSubmit();
    }
  };

  // Escape leaves the new title, not the whole form.
  const handleNewTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onChoose(null);
    }
  };

  const leaveSteps = () => {
    leftItemId.current = openedItemId;
    setOpenedItemId(null);
  };

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={newButtonRef} onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <h2 id={headingId} className="min-w-0 flex-1 text-lg font-semibold">
          Journal task
        </h2>
        <button
          type="button"
          aria-label="Close"
          disabled={isSaving}
          className="grid size-[30px] place-items-center rounded-lg text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={onClose}
        >
          <CloseIcon className="size-[18px]" />
        </button>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* Each view has its own key, so a pressed button is never reused as another one. */}
        {choice && choice.kind !== "new" ? (
          <div
            key="chosen"
            role="group"
            aria-label="Chosen task"
            className="flex items-center gap-2.5 rounded-[10px] border border-accent/40 bg-accent/6 px-3 py-2.5"
          >
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center rounded-full bg-accent text-white"
            >
              <CheckIcon className="size-2" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              {choice.kind === "step" ? (
                <span className="truncate text-[11px] text-ink-soft">{choice.item.title}</span>
              ) : null}
              <span className="truncate text-sm font-medium text-ink">
                {choice.kind === "step" ? choice.step.title : choice.item.title}
              </span>
            </span>
            {choice.kind === "item" && choice.item.due_date ? (
              <span
                className={`shrink-0 whitespace-nowrap text-[11.5px] tabular-nums ${
                  choice.item.due_date < today ? "text-danger" : "text-ink-soft"
                }`}
              >
                {dueLabel(choice.item.due_date, choice.item.start_time, today)}
              </span>
            ) : null}
            <button
              ref={changeButtonRef}
              type="button"
              disabled={isSaving}
              className="shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-card hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
              onClick={() => onChoose(null)}
            >
              Change
            </button>
          </div>
        ) : openedItem ? (
          <div key="steps" className="-mx-1.5 flex flex-col">
            <button
              ref={backButtonRef}
              type="button"
              aria-label={`Back from ${openedItem.title}`}
              className={rowClassName}
              onClick={leaveSteps}
            >
              <span aria-hidden="true" className="w-[15px] text-center text-sm text-ink-soft">
                ‹
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-soft">
                {openedItem.title}
              </span>
              <span className="shrink-0 text-[11.5px] text-ink-soft tabular-nums">
                {openedItem.progress.done}/{openedItem.progress.total}
              </span>
            </button>
            <ul aria-label={`Open steps of ${openedItem.title}`}>
              {openSteps(openedItem, draft.scheduledDate).map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    className={`${rowClassName} pl-[26px]`}
                    onClick={() => onChoose({ kind: "step", item: openedItem, step })}
                  >
                    <span
                      aria-hidden="true"
                      className="size-[13px] shrink-0 rounded-full border-[1.5px] border-ink-soft"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {step.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div key="list" className="-mx-1.5 flex flex-col">
            {choice?.kind === "new" ? (
              <div className="flex items-center gap-2 px-1.5 pb-1.5">
                <input
                  ref={newTitleRef}
                  aria-label="New task title"
                  value={choice.title}
                  placeholder="Title"
                  className={fieldClassName}
                  onChange={(event) => onNewTitleChange(event.target.value)}
                  onKeyDown={handleNewTitleKeyDown}
                />
                <button
                  type="button"
                  aria-label="Cancel new task"
                  className="grid size-[26px] shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={() => onChoose(null)}
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
            ) : (
              <button
                ref={newButtonRef}
                type="button"
                className={`${rowClassName} text-[13.5px] font-medium text-accent`}
                onClick={() => onChoose({ kind: "new", title: "" })}
              >
                <span aria-hidden="true" className="w-[15px] text-center text-base leading-none">
                  +
                </span>
                New task
              </button>
            )}

            <div aria-hidden="true" className="mx-1.5 my-1 h-px bg-line" />

            {loadError ? (
              <p role="alert" className="px-1.5 py-2 text-[13px] text-danger">
                {loadError}
              </p>
            ) : items === null ? (
              <p role="status" className="px-1.5 py-2 text-[13px] text-ink-soft">
                Loading your journal…
              </p>
            ) : rows.length === 0 ? (
              <p className="px-1.5 py-2 text-[13px] text-ink-soft">Nothing open in the Journal.</p>
            ) : (
              <>
                <ul ref={listRef} aria-label="Open Journal items">
                  {shownRows.map((item) => {
                    const hasSteps = item.steps.length > 0;
                    const titleId = `journal-choice-${item.id}-title`;
                    const detailsId = `journal-choice-${item.id}-details`;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-item-id={item.id}
                          aria-labelledby={titleId}
                          aria-describedby={detailsId}
                          className={rowClassName}
                          onClick={() =>
                            hasSteps ? setOpenedItemId(item.id) : onChoose({ kind: "item", item })
                          }
                        >
                          <span id={titleId} className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                            {item.title}
                          </span>
                          {item.due_date ? (
                            <span
                              aria-hidden="true"
                              className={`shrink-0 whitespace-nowrap text-[11.5px] tabular-nums ${
                                item.due_date < today ? "text-danger" : "text-ink-soft"
                              }`}
                            >
                              {dueLabel(item.due_date, item.start_time, today)}
                            </span>
                          ) : null}
                          {hasSteps ? (
                            <span
                              aria-hidden="true"
                              className="flex shrink-0 items-center gap-1 text-[11.5px] text-ink-soft tabular-nums"
                            >
                              {item.progress.done}/{item.progress.total}
                              <span className="text-[13px] leading-none">›</span>
                            </span>
                          ) : null}
                          <span id={detailsId} className="sr-only">
                            {choiceDetails(item, today)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!showsAll && rows.length > shortListLength ? (
                  <button
                    type="button"
                    className={`${rowClassName} text-[12.5px] text-accent`}
                    onClick={() => setShowsAll(true)}
                  >
                    Show all ({rows.length})
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClassName}>Date</span>
          <input
            type="date"
            required
            value={draft.scheduledDate}
            min={dateMode === "editable" ? today : undefined}
            disabled={dateMode === "fixed" || isSaving}
            className={`${fieldClassName} disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-soft`}
            onChange={(event) => onScheduledDateChange(event.target.value)}
          />
        </label>

        <TaskPlanFields
          startTime={draft.startTime}
          durationMinutes={draft.durationMinutes}
          blockCount={draft.blockCount}
          onStartTimeChange={onStartTimeChange}
          onDurationChange={onDurationChange}
          onBlockCountChange={onBlockCountChange}
        />

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <span className="flex-1" />
          <button type="button" disabled={isSaving} className={secondaryButtonClassName} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || isSaving}
            className={`rounded-[9px] px-4 py-[9px] text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              canSave
                ? "bg-accent text-white hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
                : "cursor-not-allowed bg-well text-ink-soft"
            }`}
          >
            {isSaving ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

// Open work that can still go on the day: an item without steps that is not there yet, or an
// item with an open step that is not there yet. An item with steps is never planned itself.
function plannableItems(items: JournalItem[], date: string) {
  return items.filter((item) =>
    item.steps.length > 0 ? openSteps(item, date).length > 0 : item.scheduled_date !== date,
  );
}

function openSteps(item: JournalItem, date: string) {
  return item.steps.filter((step) => step.status === "PENDING" && step.scheduled_date !== date);
}

function choiceDetails(item: JournalItem, today: string) {
  const due = item.due_date ? dueDescription(item.due_date, item.start_time, today) : "No due date";
  return item.steps.length > 0
    ? `${due}, ${item.progress.done} of ${item.progress.total} steps done`
    : due;
}
