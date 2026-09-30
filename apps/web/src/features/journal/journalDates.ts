const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const dayWithYearFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// A due date as Journal rows show it: the weekday and date, with the year only when it differs.
export function dueDayLabel(dueDate: string, today: string) {
  const format = dueDate.slice(0, 4) === today.slice(0, 4) ? dayFormat : dayWithYearFormat;
  return format.format(localDate(dueDate));
}

// A due date with its time, as a row's short label.
export function dueLabel(dueDate: string, startTime: string | null, today: string) {
  const day = dueDate === today ? "Today" : dueDayLabel(dueDate, today);
  return startTime ? `${day} · ${startTime}` : day;
}

// The same due date for screen readers.
export function dueDescription(dueDate: string, startTime: string | null, today: string) {
  const day = dueDate === today ? "today" : dueDayLabel(dueDate, today);
  const time = startTime ? ` at ${startTime}` : "";
  return `Due ${day}${time}${dueDate < today ? ", overdue" : ""}`;
}

// Avoid UTC shifts for date-only values.
function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
