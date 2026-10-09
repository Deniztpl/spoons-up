import { useId } from "react";

import { CloseIcon } from "../../../components/ui/CloseIcon";
import { DurationField } from "../../../components/ui/DurationField";
import { formatDuration } from "../../../lib/duration";
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

const controlClassName =
  "rounded-[7px] border border-ink/14 bg-card px-2 py-1.5 text-[13px] text-ink outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15";

export function GoalRuleFields({ label, rule, onChange, onRemove }: GoalRuleFieldsProps) {
  const durationLabelId = useId();

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
          value={rule.startTime ?? ""}
          className={`${controlClassName} w-28`}
          onChange={(event) => onChange({ startTime: event.target.value || null })}
        />
        <span id={durationLabelId} className="sr-only">
          Duration
        </span>
        <DurationField
          labelledBy={durationLabelId}
          value={rule.durationMinutes}
          size="compact"
          onChange={(value) => {
            if (value !== null) {
              onChange({ durationMinutes: value });
            }
          }}
        />
      </div>
    </div>
  );
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
    : `${formatDuration(rule.durationMinutes)}, any time`;
  return `${days} · ${time}`;
}

// Wraps past midnight the way the API computes a task's end time.
function endTime(startTime: string, minutes: number) {
  const [hours = 0, mins = 0] = startTime.split(":").map(Number);
  const end = (hours * 60 + mins + minutes) % (24 * 60);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
