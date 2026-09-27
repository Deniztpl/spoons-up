import { type FormEvent, useId, useRef } from "react";
import { Link } from "react-router";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { ModalDialog } from "../../../components/ui/ModalDialog";
import {
  type GoalAreaOptions,
  type GoalDraft,
  type GoalRuleValues,
  isGoalDraftComplete,
} from "../hooks/useGoalForm";
import { GoalDeleteConfirmation } from "./GoalDeleteConfirmation";
import { GoalRuleFields } from "./GoalRuleFields";

type GoalFormDialogProps = {
  // The area the form was opened from; null when the form asks for one.
  areaName: string | null;
  areaOptions: GoalAreaOptions | null;
  draft: GoalDraft;
  error: string | null;
  isSaving: boolean;
  isConfirmingDelete: boolean;
  onAreaChange: (areaId: string) => void;
  onTitleChange: (title: string) => void;
  onWeeklyTargetChange: (weeklyTarget: string) => void;
  onAddRule: () => void;
  onRuleChange: (key: string, changes: Partial<GoalRuleValues>) => void;
  onRemoveRule: (key: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onStartDeleting: () => void;
  onCancelDeleting: () => void;
  onDelete: () => void;
};

const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const fieldClassName =
  "w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";
const stepButtonClassName =
  "grid h-9 w-8 place-items-center text-base text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const secondaryButtonClassName =
  "rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

export function GoalFormDialog({
  areaName,
  areaOptions,
  draft,
  error,
  isSaving,
  isConfirmingDelete,
  onAreaChange,
  onTitleChange,
  onWeeklyTargetChange,
  onAddRule,
  onRuleChange,
  onRemoveRule,
  onSubmit,
  onClose,
  onStartDeleting,
  onCancelDeleting,
  onDelete,
}: GoalFormDialogProps) {
  const headingId = useId();
  const areaSelectId = useId();
  const titleInputId = useId();
  const targetInputId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isEditing = draft.saved !== null;
  const canSave = isGoalDraftComplete(draft);
  const target = draft.weeklyTarget === "" ? 0 : Number(draft.weeklyTarget);
  const ruleCount = draft.rules.length;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave && !isSaving) {
      onSubmit();
    }
  };

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={titleInputRef} onClose={onClose}>
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {areaName ? (
            <span className="truncate text-[11.5px] text-ink-soft">{areaName}</span>
          ) : null}
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="text-lg font-semibold">
              {isEditing ? "Edit goal" : "New goal"}
            </h2>
            <span className="rounded-[5px] bg-accent/12 px-[7px] py-[3px] text-[10px] font-medium uppercase tracking-[0.06em] text-accent">
              Goal
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
        {areaOptions ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={areaSelectId} className={fieldLabelClassName}>
              Area
            </label>
            <select
              id={areaSelectId}
              required
              disabled={!areaOptions.areas?.length}
              value={draft.areaId}
              className={`${fieldClassName} disabled:cursor-not-allowed disabled:text-ink-soft`}
              onChange={(event) => onAreaChange(event.target.value)}
            >
              <option value="" disabled>
                {areaPlaceholder(areaOptions)}
              </option>
              {areaOptions.areas?.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            {areaOptions.loadError ? (
              <p role="alert" className="text-[13px] text-danger">
                {areaOptions.loadError}
              </p>
            ) : null}
            {areaOptions.areas?.length === 0 ? (
              <p className="text-xs leading-5 text-ink-soft">
                Goals belong to an area.{" "}
                <Link
                  to="/areas"
                  className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Add one in Areas
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={titleInputId} className={fieldLabelClassName}>
            Title
          </label>
          <input
            ref={titleInputRef}
            id={titleInputId}
            required
            value={draft.title}
            placeholder="e.g. Finish the auth flow"
            className={fieldClassName}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={targetInputId} className={fieldLabelClassName}>
            Weekly target
          </label>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center overflow-hidden rounded-lg border border-ink/14 bg-card focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
              <button
                type="button"
                aria-label="Decrease weekly target"
                className={stepButtonClassName}
                onClick={() => onWeeklyTargetChange(target <= 1 ? "" : String(target - 1))}
              >
                −
              </button>
              <input
                id={targetInputId}
                inputMode="numeric"
                value={draft.weeklyTarget}
                placeholder="—"
                className="h-9 w-10 border-x border-line bg-transparent text-center text-sm font-medium text-ink outline-none placeholder:text-ink-soft"
                onChange={(event) => onWeeklyTargetChange(weeklyTargetValue(event.target.value))}
              />
              <button
                type="button"
                aria-label="Increase weekly target"
                className={stepButtonClassName}
                onClick={() => onWeeklyTargetChange(String(Math.min(99, target + 1)))}
              >
                +
              </button>
            </div>
            <span className="text-[13px] text-ink-soft">blocks / week</span>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex items-baseline gap-2">
            <span className={fieldLabelClassName}>Rules</span>
            {ruleCount > 0 ? (
              <span className="text-[11px] text-ink-soft">
                {ruleCount} {ruleCount === 1 ? "rule" : "rules"}
              </span>
            ) : null}
          </legend>
          {draft.rules.map((rule, index) => (
            <GoalRuleFields
              key={rule.key}
              label={`Rule ${index + 1}`}
              rule={rule}
              onChange={(changes) => onRuleChange(rule.key, changes)}
              onRemove={() => onRemoveRule(rule.key)}
            />
          ))}
          {ruleCount === 0 ? (
            <p className="py-0.5 text-xs text-ink-soft">
              No rules. The goal isn't tied to a day or time.
            </p>
          ) : null}
          <button
            type="button"
            className="rounded-[9px] border border-dashed border-ink/20 px-2.5 py-2 text-left text-[12.5px] font-medium text-accent transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onAddRule}
          >
            <span aria-hidden="true">+</span> Add rule
          </button>
        </fieldset>

        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {isConfirmingDelete ? (
          <GoalDeleteConfirmation
            goalTitle={draft.saved?.title ?? draft.title}
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
    </ModalDialog>
  );
}

function areaPlaceholder({ areas, loadError }: GoalAreaOptions) {
  if (loadError) {
    return "Areas couldn't load";
  }
  if (areas === null) {
    return "Loading areas…";
  }
  return areas.length === 0 ? "No active areas" : "Choose an area";
}

// Blank means no weekly target; otherwise a whole number from 1 to 99.
function weeklyTargetValue(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 2);
  return digits === "" || Number(digits) === 0 ? "" : String(Number(digits));
}
