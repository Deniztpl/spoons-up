import { type FormEvent, type RefObject, useId, useRef } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import type { Area } from "../../areas/api/areasApi";
import type { Goal } from "../../goals/api/goalsApi";
import {
  isScheduleChanged,
  isTaskChanged,
  isTaskDraftComplete,
  type TaskDraft,
} from "../hooks/useTaskForm";
import { TaskDeleteConfirmation } from "./TaskDeleteConfirmation";

type TaskFormDialogProps = {
  draft: TaskDraft;
  areas: Area[] | null;
  goals: Goal[] | null;
  optionsError: string | null;
  error: string | null;
  isSaving: boolean;
  isConfirmingDelete: boolean;
  onGoalChange: (goalId: string) => void;
  onTitleChange: (title: string) => void;
  onStartTimeChange: (startTime: string) => void;
  onDurationChange: (durationMinutes: string) => void;
  onBlockCountChange: (blockCount: string) => void;
  onRepeatChange: (isRepeating: boolean) => void;
  onWeekdayToggle: (weekday: number) => void;
  onSubmit: () => void;
  onClose: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

const weekdays = [
  { value: 1, letter: "M", name: "Monday" },
  { value: 2, letter: "T", name: "Tuesday" },
  { value: 3, letter: "W", name: "Wednesday" },
  { value: 4, letter: "T", name: "Thursday" },
  { value: 5, letter: "F", name: "Friday" },
  { value: 6, letter: "S", name: "Saturday" },
  { value: 7, letter: "S", name: "Sunday" },
];
const durationOptions = [15, 30, 45, 60, 90, 120, 180];
const blockOptions = ["", "0.5", "1", "2", "4"];
const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const fieldClassName =
  "w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";
const secondaryButtonClassName =
  "rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

export function TaskFormDialog({
  draft,
  areas,
  goals,
  optionsError,
  error,
  isSaving,
  isConfirmingDelete,
  onGoalChange,
  onTitleChange,
  onStartTimeChange,
  onDurationChange,
  onBlockCountChange,
  onRepeatChange,
  onWeekdayToggle,
  onSubmit,
  onClose,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: TaskFormDialogProps) {
  const headingId = useId();
  const goalId = useId();
  const titleId = useId();
  const blockName = useId();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const isEditing = draft.task !== null;
  const isGoalLinked = draft.goalId !== "";
  const taskChanged = isTaskChanged(draft);
  const scheduleChanged = isScheduleChanged(draft);
  const canSave =
    isTaskDraftComplete(draft) && (!isEditing || taskChanged || scheduleChanged);
  const selectedWeekday = weekdayForDate(draft.scheduledDate);
  const shownDurations = withNumberValue(durationOptions, draft.durationMinutes);
  const shownBlocks = withStringValue(blockOptions, draft.blockCount);
  const areaNames = new Map(areas?.map((area) => [area.id, area.name]));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave && !isSaving) {
      onSubmit();
    }
  };

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={initialFocusRef} onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 id={headingId} className="text-lg font-semibold">
            {isEditing ? "Edit task" : "New task"}
          </h2>
          <span className="rounded-[5px] bg-accent/12 px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-accent">
            Task
          </span>
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
        {isEditing ? (
          isGoalLinked ? (
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabelClassName}>Goal</span>
              <div className="rounded-lg border border-ink/14 bg-well px-[11px] py-[9px] text-sm text-ink">
                {draft.task?.title}
              </div>
            </div>
          ) : (
            <TitleField
              inputId={titleId}
              inputRef={initialFocusRef}
              title={draft.title}
              onChange={onTitleChange}
            />
          )
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={goalId} className={fieldLabelClassName}>
                Goal
              </label>
              <select
                id={goalId}
                value={draft.goalId}
                disabled={areas === null || goals === null}
                className={`${fieldClassName} disabled:cursor-wait disabled:text-ink-soft`}
                onChange={(event) => onGoalChange(event.target.value)}
              >
                <option value="">No goal</option>
                {goals?.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {areaNames.get(goal.area_id)} - {goal.title}
                  </option>
                ))}
              </select>
            </div>

            {draft.goalId === "" ? (
              <TitleField
                inputId={titleId}
                inputRef={initialFocusRef}
                title={draft.title}
                onChange={onTitleChange}
              />
            ) : null}
          </>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClassName}>Start time</span>
            <input
              ref={isEditing && isGoalLinked ? initialFocusRef : undefined}
              type="time"
              value={draft.startTime}
              className={fieldClassName}
              onChange={(event) => onStartTimeChange(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClassName}>Duration</span>
            <select
              value={draft.durationMinutes}
              className={fieldClassName}
              onChange={(event) => onDurationChange(event.target.value)}
            >
              <option value="">No duration</option>
              {shownDurations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {durationLabel(minutes)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${fieldLabelClassName} mb-1.5`}>Blocks</legend>
          <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[7px] border border-ink/12 bg-card p-0.5">
            {shownBlocks.map((count) => (
              <label key={count || "none"}>
                <input
                  type="radio"
                  name={blockName}
                  value={count}
                  checked={draft.blockCount === count}
                  aria-label={blockLabel(count)}
                  className="peer sr-only"
                  onChange={() => onBlockCountChange(count)}
                />
                <span className="block cursor-pointer rounded-[5px] py-1 text-center text-xs font-medium text-ink-soft transition peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {count === "" ? "—" : count === "0.5" ? "½" : count}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {!isEditing && isGoalLinked ? (
          <fieldset className="flex flex-col gap-2.5">
            <legend className={`${fieldLabelClassName} mb-1.5`}>Schedule</legend>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-ink/14 bg-card px-3 py-2.5">
              <input
                type="checkbox"
                checked={draft.isRepeating}
                className="size-4 accent-accent"
                onChange={(event) => onRepeatChange(event.target.checked)}
              />
              <span className="text-[13px] font-medium text-ink">Repeat</span>
            </label>
            {draft.isRepeating ? (
              <WeekdayPicker
                selected={draft.byweekday}
                requiredWeekday={selectedWeekday}
                onToggle={onWeekdayToggle}
              />
            ) : null}
          </fieldset>
        ) : null}

        {isEditing && draft.task?.rule_id ? (
          <fieldset className="flex flex-col gap-2.5">
            <legend className={`${fieldLabelClassName} mb-1.5`}>Schedule</legend>
            {draft.savedWeekdays === null ? (
              <p role="status" className="text-xs text-ink-soft">
                Loading schedule…
              </p>
            ) : (
              <WeekdayPicker selected={draft.byweekday} onToggle={onWeekdayToggle} />
            )}
          </fieldset>
        ) : null}

        {optionsError ? (
          <p role="alert" className="text-[13px] text-danger">
            {optionsError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {isConfirmingDelete ? (
          <TaskDeleteConfirmation
            taskTitle={draft.task?.title ?? draft.title}
            isGoalLinked={isGoalLinked}
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
              disabled={!canSave || isSaving}
              className={`rounded-[9px] px-4 py-[9px] text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                canSave
                  ? "bg-accent text-white hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60"
                  : "cursor-not-allowed bg-well text-ink-soft"
              }`}
            >
              {isSaving ? "Saving…" : isEditing ? "Save" : "Add"}
            </button>
          </div>
        )}
      </form>
    </ModalDialog>
  );
}

function TitleField({
  inputId,
  inputRef,
  title,
  onChange,
}: {
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  title: string;
  onChange: (title: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={fieldLabelClassName}>
        Title
      </label>
      <input
        ref={inputRef}
        id={inputId}
        required
        value={title}
        placeholder="e.g. Pick up groceries"
        className={fieldClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function WeekdayPicker({
  selected,
  requiredWeekday,
  onToggle,
}: {
  selected: number[];
  requiredWeekday?: number;
  onToggle: (weekday: number) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdays.map((day) => {
        const isRequired = day.value === requiredWeekday;
        const isSelected = selected.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            aria-label={isRequired ? `${day.name}, task date` : day.name}
            aria-pressed={isSelected}
            disabled={isRequired}
            className={`h-8 rounded-[7px] border text-[11.5px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isSelected
                ? "border-accent bg-accent text-white"
                : "border-ink/12 bg-card text-ink-soft hover:text-ink"
            } disabled:cursor-default`}
            onClick={() => onToggle(day.value)}
          >
            {day.letter}
          </button>
        );
      })}
    </div>
  );
}

function weekdayForDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCDay() || 7;
}

function durationLabel(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function withNumberValue(options: number[], value: string) {
  if (value === "") {
    return options;
  }
  const number = Number(value);
  return options.includes(number) ? options : [...options, number].sort((a, b) => a - b);
}

function withStringValue(options: string[], value: string) {
  return value === "" || options.includes(value)
    ? options
    : [...options, value].sort((a, b) => Number(a || 0) - Number(b || 0));
}

function blockLabel(value: string) {
  if (value === "") {
    return "No block value";
  }
  if (value === "0.5") {
    return "Half a block";
  }
  return value === "1" ? "1 block" : `${value} blocks`;
}
