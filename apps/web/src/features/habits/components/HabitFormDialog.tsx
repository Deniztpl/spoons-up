import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useRef,
} from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import type { HabitMode } from "../api/habitsApi";
import { HabitDeleteConfirmation } from "./HabitDeleteConfirmation";

type HabitFormDialogProps = {
  areaName: string;
  isEditing: boolean;
  savedTitle: string;
  title: string;
  mode: HabitMode;
  error: string | null;
  isSaving: boolean;
  isConfirmingDelete: boolean;
  onTitleChange: (title: string) => void;
  onModeChange: (mode: HabitMode) => void;
  onSubmit: () => void;
  onClose: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

const modeOptions: { value: HabitMode; label: string; hint: string }[] = [
  { value: "DAILY", label: "Daily", hint: "Checked off once a day." },
  { value: "WEEKLY", label: "Weekly", hint: "Checked off once a week, on any day." },
];

const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const secondaryButtonClassName =
  "rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";
const focusableSelector =
  'button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked, [href]';

export function HabitFormDialog({
  areaName,
  isEditing,
  savedTitle,
  title,
  mode,
  error,
  isSaving,
  isConfirmingDelete,
  onTitleChange,
  onModeChange,
  onSubmit,
  onClose,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: HabitFormDialogProps) {
  const headingId = useId();
  const titleInputId = useId();
  const modeName = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hasTitle = title.trim().length > 0;
  const modeHint = modeOptions.find((option) => option.value === mode)?.hint;

  // Restore focus when the dialog closes.
  useEffect(() => {
    const opener = document.activeElement;
    titleInputRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasTitle && !isSaving) {
      onSubmit();
    }
  };

  // Keep keyboard focus inside the dialog.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/28 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex max-h-[88vh] w-[440px] max-w-full flex-col gap-4 overflow-y-auto rounded-[14px] bg-card px-6 py-[22px] shadow-[0_24px_60px_rgb(28_43_33/0.25)]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[11.5px] text-ink-soft">{areaName}</span>
            <div className="flex items-center gap-2">
              <h2 id={headingId} className="text-lg font-semibold">
                {isEditing ? "Edit habit" : "New habit"}
              </h2>
              <span className="rounded-[5px] bg-habit/12 px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-habit-strong">
                Habit
              </span>
            </div>
          </div>
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={titleInputId} className={fieldLabelClassName}>
              Title
            </label>
            <input
              ref={titleInputRef}
              id={titleInputId}
              required
              value={title}
              placeholder="e.g. Practice for 30 minutes"
              className="w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15"
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${fieldLabelClassName} mb-1.5`}>Mode</legend>
            <div className="flex gap-[3px] rounded-[9px] border border-line bg-well p-[3px] text-[13px] font-medium">
              {modeOptions.map((option) => (
                <label key={option.value} className="flex-1">
                  <input
                    type="radio"
                    name={modeName}
                    value={option.value}
                    checked={mode === option.value}
                    className="peer sr-only"
                    onChange={() => onModeChange(option.value)}
                  />
                  <span className="block cursor-pointer rounded-[7px] px-2.5 py-[7px] text-center text-ink-soft transition peer-checked:bg-card peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-soft">{modeHint}</p>
          </fieldset>

          {error ? (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          {isConfirmingDelete ? (
            <HabitDeleteConfirmation
              habitTitle={savedTitle}
              isSaving={isSaving}
              onCancel={onCancelDeleting}
              onDelete={onDelete}
            />
          ) : (
            <div className="flex items-center gap-2 pt-1">
              {isEditing ? (
                <button
                  type="button"
                  disabled={isSaving}
                  className="-ml-1.5 rounded-lg px-1.5 py-2 text-[13px] font-medium text-danger transition hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
                  onClick={onStartDeleting}
                >
                  Delete
                </button>
              ) : null}
              <span className="flex-1" />
              <button
                type="button"
                disabled={isSaving}
                className={secondaryButtonClassName}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!hasTitle || isSaving}
                className={`rounded-[9px] px-4 py-[9px] text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  hasTitle
                    ? "bg-accent text-white hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
                    : "cursor-not-allowed bg-well text-ink-soft"
                }`}
              >
                {isSaving
                  ? isEditing
                    ? "Saving…"
                    : "Adding…"
                  : isEditing
                    ? "Save"
                    : "Add"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
