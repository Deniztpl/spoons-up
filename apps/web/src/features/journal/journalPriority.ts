import type { JournalItem } from "./api/journalApi";

export type JournalPriority = NonNullable<JournalItem["priority"]>;

// Tag colours: red for high, amber for medium, green for low; each text shade meets WCAG AA
// on its own background.
export const priorityOptions: { value: JournalPriority; label: string; className: string }[] = [
  { value: "LOW", label: "Low", className: "bg-[#e6efe4] text-[#466b44]" },
  { value: "MEDIUM", label: "Medium", className: "bg-[#f4ead9] text-[#7a5c35]" },
  { value: "HIGH", label: "High", className: "bg-danger-soft text-danger" },
];

export const priorityTagClassName =
  "inline-flex items-center rounded-[5px] px-[7px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em]";

export function priorityOption(priority: JournalPriority) {
  return priorityOptions.find((option) => option.value === priority) ?? priorityOptions[0]!;
}
