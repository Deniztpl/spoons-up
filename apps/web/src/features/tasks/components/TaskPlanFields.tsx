import { type RefObject, useId } from "react";

import { DurationField } from "../../../components/ui/DurationField";
import { planEndLabel } from "../../../lib/duration";

type TaskPlanFieldsProps = {
  startTime: string;
  durationMinutes: string;
  // Goal work always carries its hours; Journal work may go without.
  isDurationRequired: boolean;
  startTimeRef?: RefObject<HTMLInputElement | null>;
  onStartTimeChange: (startTime: string) => void;
  onDurationChange: (durationMinutes: string) => void;
};

const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const fieldClassName =
  "h-10 w-full rounded-lg border border-ink/14 bg-card px-[11px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";

// The plan values a task takes when it is put on a day: an optional time and its hours. The two
// sit side by side at the same height, stacked on a phone; under the time, where the work ends.
export function TaskPlanFields({
  startTime,
  durationMinutes,
  isDurationRequired,
  startTimeRef,
  onStartTimeChange,
  onDurationChange,
}: TaskPlanFieldsProps) {
  const durationLabelId = useId();
  const duration = durationMinutes === "" ? null : Number(durationMinutes);
  const endLabel = planEndLabel(startTime, duration);

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClassName}>Start time</span>
          <input
            ref={startTimeRef}
            type="time"
            value={startTime}
            className={fieldClassName}
            onChange={(event) => onStartTimeChange(event.target.value)}
          />
        </label>
        {endLabel ? (
          <p className="flex h-7 items-center text-[11.5px] text-ink-soft tabular-nums">
            {endLabel}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span id={durationLabelId} className={fieldLabelClassName}>
          Duration
        </span>
        <DurationField
          labelledBy={durationLabelId}
          value={duration}
          isOptional={!isDurationRequired}
          onChange={(value) => onDurationChange(value === null ? "" : String(value))}
        />
      </div>
    </div>
  );
}
