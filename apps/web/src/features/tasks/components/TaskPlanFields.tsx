import { type RefObject, useId } from "react";

import { DurationField } from "../../../components/ui/DurationField";

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
  "w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";

// The plan values a task takes when it is put on a day: an optional time and its hours.
export function TaskPlanFields({
  startTime,
  durationMinutes,
  isDurationRequired,
  startTimeRef,
  onStartTimeChange,
  onDurationChange,
}: TaskPlanFieldsProps) {
  const durationLabelId = useId();

  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2.5">
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
      <div className="flex flex-col gap-1.5">
        <span id={durationLabelId} className={fieldLabelClassName}>
          Duration
        </span>
        <DurationField
          labelledBy={durationLabelId}
          value={durationMinutes === "" ? null : Number(durationMinutes)}
          isOptional={!isDurationRequired}
          onChange={(value) => onDurationChange(value === null ? "" : String(value))}
        />
      </div>
    </div>
  );
}
