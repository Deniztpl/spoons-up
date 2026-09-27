import { useId } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import type { GoalRuleDraft, GoalRuleValues } from "../hooks/useGoalForm";

type GoalRuleFieldsProps = {
  label: string;
  rule: GoalRuleDraft;
  onChange: (changes: Partial<GoalRuleValues>) => void;
  onRemove: () => void;
};

// `byweekday` is ISO: 1 is Monday, 7 is Sunday.
const weekdays = [
  { value: 1, letter: "M", short: "Mon", name: "Monday" },
  { value: 2, letter: "T", short: "Tue", name: "Tuesday" },
  { value: 3, letter: "W", short: "Wed", name: "Wednesday" },
  { value: 4, letter: "T", short: "Thu", name: "Thursday" },
  { value: 5, letter: "F", short: "Fri", name: "Friday" },
  { value: 6, letter: "S", short: "Sat", name: "Saturday" },
  { value: 7, letter: "S", short: "Sun", name: "Sunday" },
];
const durations = [15, 30, 45, 60, 90, 120, 180];
const blockCounts = [0.5, 1, 2, 4];

const controlClassName =
  "rounded-[7px] border border-ink/14 bg-card px-2 py-1.5 text-[13px] text-ink outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function GoalRuleFields({ label, rule, onChange, onRemove }: GoalRuleFieldsProps) {
  const blockName = useId();
  // Keep values set outside the offered options selectable.
  const durationOptions = withValue(durations, rule.durationMinutes);
  const blockOptions = withValue(blockCounts, rule.blockCount);

  const toggleDay = (day: number) =>
    onChange({
      byweekday: rule.byweekday.includes(day)
        ? rule.byweekday.filter((value) => value !== day)
        : [...rule.byweekday, day].sort((a, b) => a - b),
    });

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-well px-3 py-[11px]"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[12.5px] text-ink-soft">{ruleSummary(rule)}</span>
        <button
          type="button"
          aria-label={`Remove ${label.toLowerCase()}`}
          className="grid size-6 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-track hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onRemove}
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((day) => {
          const isSelected = rule.byweekday.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-label={day.name}
              aria-pressed={isSelected}
              className={`h-7 rounded-[7px] border text-[11.5px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isSelected
                  ? "border-accent bg-accent text-white"
                  : "border-ink/12 bg-card text-ink-soft hover:text-ink"
              }`}
              onClick={() => toggleDay(day.value)}
            >
              {day.letter}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="time"
          aria-label="Start time"
          required
          value={rule.startTime}
          className={`${controlClassName} w-28`}
          onChange={(event) => onChange({ startTime: event.target.value })}
        />
        <select
          aria-label="Duration"
          value={rule.durationMinutes}
          className={controlClassName}
          onChange={(event) => onChange({ durationMinutes: Number(event.target.value) })}
        >
          {durationOptions.map((minutes) => (
            <option key={minutes} value={minutes}>
              {durationLabel(minutes)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-[5px] text-[11.5px] text-ink-soft">Blocks</legend>
        <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[7px] border border-ink/12 bg-card p-0.5">
          {blockOptions.map((count) => (
            <label key={count}>
              <input
                type="radio"
                name={blockName}
                value={count}
                checked={rule.blockCount === count}
                aria-label={blockCountLabel(count)}
                className="peer sr-only"
                onChange={() => onChange({ blockCount: count })}
              />
              <span
                aria-hidden="true"
                className="block cursor-pointer rounded-[5px] py-1 text-center text-xs font-medium text-ink-soft transition peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
              >
                {count === 0.5 ? "½" : count}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function withValue(options: number[], value: number) {
  return options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
}

function ruleSummary(rule: GoalRuleDraft) {
  const days = rule.byweekday.length
    ? weekdays
        .filter((day) => rule.byweekday.includes(day.value))
        .map((day) => day.short)
        .join(", ")
    : "No days selected";
  const time = rule.startTime
    ? `${rule.startTime}–${endTime(rule.startTime, rule.durationMinutes)}`
    : "No start time";
  return `${days} · ${time}`;
}

// Wraps past midnight the way the API computes a task's end time.
function endTime(startTime: string, minutes: number) {
  const [hours = 0, mins = 0] = startTime.split(":").map(Number);
  const end = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function durationLabel(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function blockCountLabel(count: number) {
  if (count === 0.5) {
    return "Half a block";
  }
  return count === 1 ? "1 block" : `${count} blocks`;
}
