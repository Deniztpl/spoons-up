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

const presets = [30, 60, 120, 240];

// A stepper in 15-minute steps up to a day, as tall and wide as the fields beside it, with the
// usual lengths in an even row under it.
export function DurationField({
  labelledBy,
  value,
  isOptional = false,
  size = "regular",
  onChange,
}: DurationFieldProps) {
  const isCompact = size === "compact";
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

  const stepClassName = `grid shrink-0 place-items-center text-ink-soft transition enabled:hover:bg-well enabled:hover:text-ink disabled:text-muted-light ${
    isCompact ? "w-8" : "w-10"
  }`;
  const presetClassName = `rounded-md border font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    isCompact ? "h-6 text-[11px]" : "h-7 text-[11.5px]"
  }`;

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex min-w-0 flex-col gap-1.5">
      <div
        className={`flex items-stretch overflow-hidden border border-ink/14 bg-card transition focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 ${
          isCompact ? "h-8 rounded-[7px]" : "h-10 rounded-lg"
        }`}
      >
        <button
          type="button"
          aria-label="Shorter"
          tabIndex={-1}
          disabled={!canShorten}
          className={stepClassName}
          onClick={shorten}
        >
          <StepIcon sign="minus" />
        </button>
        <span
          role="spinbutton"
          tabIndex={0}
          aria-label="Duration"
          aria-valuemin={isOptional ? 0 : DURATION_STEP_MINUTES}
          aria-valuemax={MAX_DURATION_MINUTES}
          aria-valuenow={value ?? 0}
          aria-valuetext={value === null ? "No duration" : describeDuration(value)}
          className={`flex min-w-0 flex-1 items-center justify-center whitespace-nowrap px-1 font-medium outline-none tabular-nums ${
            isCompact ? "text-[13px]" : "text-sm"
          } ${value === null ? "text-ink-soft" : "text-ink"}`}
          onKeyDown={handleKeyDown}
        >
          {value === null ? "None" : formatDuration(value)}
        </span>
        <button
          type="button"
          aria-label="Longer"
          tabIndex={-1}
          disabled={!canLengthen}
          className={stepClassName}
          onClick={lengthen}
        >
          <StepIcon sign="plus" />
        </button>
      </div>

      <div className={`grid gap-1 ${isOptional ? "grid-cols-5" : "grid-cols-4"}`}>
        {isOptional ? (
          <button
            type="button"
            aria-pressed={value === null}
            className={`${presetClassName} ${presetTone(value === null)}`}
            onClick={() => onChange(null)}
          >
            None
          </button>
        ) : null}
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={value === minutes}
            aria-label={describeDuration(minutes)}
            className={`${presetClassName} ${presetTone(value === minutes)}`}
            onClick={() => onChange(minutes)}
          >
            {formatDuration(minutes)}
          </button>
        ))}
      </div>
    </div>
  );
}

function presetTone(isSelected: boolean) {
  return isSelected
    ? "border-accent/45 bg-accent/10 text-accent-strong"
    : "border-ink/10 bg-card text-ink-soft hover:border-ink/20 hover:text-ink";
}

function StepIcon({ sign }: { sign: "minus" | "plus" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none">
      <path
        d={sign === "minus" ? "M2.5 6h7" : "M2.5 6h7M6 2.5v7"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
