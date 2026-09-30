import { type RefObject, useId } from "react";

type TaskPlanFieldsProps = {
  startTime: string;
  durationMinutes: string;
  blockCount: string;
  startTimeRef?: RefObject<HTMLInputElement | null>;
  onStartTimeChange: (startTime: string) => void;
  onDurationChange: (durationMinutes: string) => void;
  onBlockCountChange: (blockCount: string) => void;
};

const durationOptions = [15, 30, 45, 60, 90, 120, 180];
const blockOptions = ["", "0.5", "1", "2", "4"];
const fieldLabelClassName =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft";
const fieldClassName =
  "w-full rounded-lg border border-ink/14 bg-card px-[11px] py-[9px] text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15";

// The optional plan values a task takes when it is put on a day: time, duration and blocks.
export function TaskPlanFields({
  startTime,
  durationMinutes,
  blockCount,
  startTimeRef,
  onStartTimeChange,
  onDurationChange,
  onBlockCountChange,
}: TaskPlanFieldsProps) {
  const blockName = useId();
  const shownDurations = withNumberValue(durationOptions, durationMinutes);
  const shownBlocks = withStringValue(blockOptions, blockCount);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
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
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabelClassName}>Duration</span>
          <select
            value={durationMinutes}
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
                checked={blockCount === count}
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
    </>
  );
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
