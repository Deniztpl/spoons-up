import type { JournalItem } from "./api/journalApi";
import { priorityOptions } from "./journalPriority";

export type JournalSort = "due" | "added" | "priority";

export const sortOptions: { value: JournalSort; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "added", label: "Date added" },
  { value: "priority", label: "Priority" },
];

// Due date is the API's own order. The others sort a copy, and ties keep the API's order.
export function sortJournalItems(items: JournalItem[], sort: JournalSort) {
  if (sort === "due") {
    return items;
  }
  if (sort === "added") {
    return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
  // High to Low, then items without a priority.
  const rank = (item: JournalItem) =>
    priorityOptions.findIndex((option) => option.value === item.priority);
  return [...items].sort((a, b) => rank(b) - rank(a));
}
