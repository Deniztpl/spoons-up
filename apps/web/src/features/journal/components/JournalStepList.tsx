import { type KeyboardEvent, useId, useRef, useState } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import { CloseIcon } from "../../../components/ui/CloseIcon";
import type { JournalStep } from "../api/journalApi";
import type { UnsavedStep } from "../hooks/useJournalDetail";

type JournalStepListProps = {
  steps: JournalStep[];
  unsavedSteps: UnsavedStep[];
  pendingStepIds: string[];
  isDisabled: boolean;
  // Returns false when the step was not taken, so the typed title stays.
  onAdd: (title: string) => boolean;
  onToggle: (step: JournalStep) => void;
  onDelete: (step: JournalStep) => Promise<boolean>;
  onRemoveUnsaved: (key: number) => void;
  onRetry: () => void;
};

const removeButtonClassName =
  "grid size-[22px] shrink-0 place-items-center rounded-md text-muted transition hover:bg-track hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

export function JournalStepList({
  steps,
  unsavedSteps,
  pendingStepIds,
  isDisabled,
  onAdd,
  onToggle,
  onDelete,
  onRemoveUnsaved,
  onRetry,
}: JournalStepListProps) {
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const doneCount = steps.filter((step) => step.status === "DONE").length;
  const hasFailed = unsavedSteps.some((step) => step.state === "failed");

  // Enter adds the step and keeps the entry ready for the next one.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (onAdd(title)) {
      setTitle("");
    }
  };

  // The removed row took focus with it, so hand it to the entry.
  const deleteStep = async (step: JournalStep) => {
    if (await onDelete(step)) {
      inputRef.current?.focus();
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col border-t border-line pt-3">
      <div className="flex items-baseline gap-2 pb-1">
        <h3 id={headingId} className="text-xs text-ink-soft">
          Steps
        </h3>
        {steps.length > 0 ? (
          <span className="text-[11.5px] text-ink-soft tabular-nums">
            <span aria-hidden="true">
              {doneCount}/{steps.length}
            </span>
            <span className="sr-only">
              {doneCount} of {steps.length} done
            </span>
          </span>
        ) : null}
      </div>

      {steps.length > 0 || unsavedSteps.length > 0 ? (
        <ul aria-labelledby={headingId} className="flex flex-col">
          {steps.map((step) => {
            const isDone = step.status === "DONE";
            const isPending = pendingStepIds.includes(step.id);
            const checkId = `journal-step-${step.id}-check`;
            const titleId = `journal-step-${step.id}-title`;
            return (
              <li
                key={step.id}
                className="-mx-1.5 flex items-center gap-2.5 rounded-[7px] px-1.5 py-1.5 transition hover:bg-well"
              >
                <label htmlFor={checkId} className={isPending ? "cursor-wait" : "cursor-pointer"}>
                  <input
                    id={checkId}
                    type="checkbox"
                    checked={isDone}
                    disabled={isPending || isDisabled}
                    aria-labelledby={titleId}
                    className="peer sr-only"
                    onChange={() => onToggle(step)}
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-[15px] shrink-0 place-items-center rounded-full border-[1.5px] border-ink-soft text-white peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  >
                    {isDone ? <CheckIcon className="size-2" /> : null}
                  </span>
                </label>
                <span
                  id={titleId}
                  className={`min-w-0 flex-1 break-words text-[13.5px] ${
                    isDone ? "text-ink-soft line-through" : "text-ink"
                  }`}
                >
                  {step.title}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${step.title}`}
                  disabled={isPending || isDisabled}
                  className={removeButtonClassName}
                  onClick={() => void deleteStep(step)}
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </li>
            );
          })}

          {unsavedSteps.map((step) => (
            <li key={`unsaved-${step.key}`} className="-mx-1.5 flex items-center gap-2.5 px-1.5 py-1.5">
              <span
                aria-hidden="true"
                className="size-[15px] shrink-0 rounded-full border-[1.5px] border-dashed border-muted-light"
              />
              <span className="min-w-0 flex-1 break-words text-[13.5px] text-ink">{step.title}</span>
              {step.state === "saving" ? (
                <span className="shrink-0 text-[11.5px] text-ink-soft">Saving…</span>
              ) : null}
              {step.state === "failed" ? (
                <span className="shrink-0 text-[11.5px] font-medium text-danger">Not saved</span>
              ) : null}
              {step.state !== "saving" ? (
                <button
                  type="button"
                  aria-label={`Remove ${step.title}`}
                  disabled={isDisabled}
                  className={removeButtonClassName}
                  onClick={() => {
                    onRemoveUnsaved(step.key);
                    inputRef.current?.focus();
                  }}
                >
                  <CloseIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {hasFailed ? (
        <button
          type="button"
          disabled={isDisabled}
          className="-mx-1.5 self-start rounded-md px-1.5 py-1 text-[12.5px] font-medium text-accent transition hover:bg-well hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          onClick={() => {
            onRetry();
            inputRef.current?.focus();
          }}
        >
          Retry unsaved steps
        </button>
      ) : null}

      <div className="-mx-1.5 flex items-center gap-2.5 rounded-[7px] px-1.5 py-1.5 focus-within:bg-well focus-within:ring-2 focus-within:ring-accent/25">
        <span aria-hidden="true" className="w-[15px] shrink-0 text-center text-[15px] leading-none text-ink-soft">
          +
        </span>
        <input
          ref={inputRef}
          value={title}
          aria-label="Add step"
          placeholder="Add step"
          disabled={isDisabled}
          className="min-w-0 flex-1 bg-transparent p-0 text-[13.5px] text-ink outline-none placeholder:text-ink-soft disabled:cursor-wait"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </section>
  );
}
