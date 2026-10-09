import type { KeyboardEvent } from "react";

import {
  DURATION_STEP_MINUTES,
  MAX_DURATION_MINUTES,
  describeDuration,
  formatDuration,
} from "../../lib/duration";

type DurationFieldProps = {
  // The id of the visible label that names the field.
  labelledBy: string;
  value: number | null;
  // Journal work may go without a duration; goal work always has one.
  isOptional?: boolean;
  size?: "regular" | "compact";
  onChange: (value: number | null) => void;
};

const shortcuts = [30, 60, 120, 240];

// A stepper in 15-minute steps up to a day, with shortcuts for the usual lengths.
export function DurationField({
  labelledBy,
  value,
  isOptional = false,
  size = "regular",
  onChange,
}: DurationFieldProps) {
  const height = size === "compact" ? "h-8" : "h-9";
  const canShorten = value !== null && (isOptional || value > DURATION_STEP_MINUTES);
  const canLengthen = value === null || value < MAX_DURATION_MINUTES;

  // Steps land on the 15-minute grid; shortening an optional duration past 15 minutes clears it.
  const shorten = () => {
    if (value === null || !canShorten) {
      return;
    }
    const next = (Math.ceil(value / DURATION_STEP_MINUTES) - 1) * DURATION_STEP_MINUTES;
    onChange(next > 0 ? next : null);
  };
  const lengthen = () => {
    if (!canLengthen) {
      return;
    }
    const next = (Math.floor((value ?? 0) / DURATION_STEP_MINUTES) + 1) * DURATION_STEP_MINUTES;
    onChange(Math.min(MAX_DURATION_MINUTES, next));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      lengthen();
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      shorten();
    }
  };

  const stepButtonClassName = `grid ${height} w-8 place-items-center text-base text-ink-soft transition enabled:hover:bg-well enabled:hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:text-muted-light`;
  const choiceClassName = `${height} rounded-[7px] border px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center overflow-hidden rounded-lg border border-ink/14 bg-card focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
        <button
          type="button"
          aria-label="Shorter"
          tabIndex={-1}
          disabled={!canShorten}
          className={stepButtonClassName}
          onClick={shorten}
        >
          −
        </button>
        <span
          role="spinbutton"
          tabIndex={0}
          aria-label="Duration"
          aria-valuemin={isOptional ? 0 : DURATION_STEP_MINUTES}
          aria-valuemax={MAX_DURATION_MINUTES}
          aria-valuenow={value ?? 0}
          aria-valuetext={value === null ? "No duration" : describeDuration(value)}
          className={`grid ${height} min-w-[66px] place-items-center border-x border-line px-1.5 text-sm font-medium text-ink outline-none tabular-nums`}
          onKeyDown={handleKeyDown}
        >
          {value === null ? "—" : formatDuration(value)}
        </span>
        <button
          type="button"
          aria-label="Longer"
          tabIndex={-1}
          disabled={!canLengthen}
          className={stepButtonClassName}
          onClick={lengthen}
        >
          +
        </button>
      </div>

      <div className="flex gap-1">
        {isOptional ? (
          <button
            type="button"
            aria-pressed={value === null}
            className={`${choiceClassName} ${choiceTone(value === null)}`}
            onClick={() => onChange(null)}
          >
            None
          </button>
        ) : null}
        {shortcuts.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={value === minutes}
            aria-label={describeDuration(minutes)}
            className={`${choiceClassName} ${choiceTone(value === minutes)}`}
            onClick={() => onChange(minutes)}
          >
            {formatDuration(minutes)}
          </button>
        ))}
      </div>
    </div>
  );
}

function choiceTone(isSelected: boolean) {
  return isSelected
    ? "border-accent bg-accent text-white"
    : "border-ink/12 bg-card text-ink-soft hover:text-ink";
}
