// Hours are the unit of work. The API keeps them as minutes in 15-minute steps up to a day.
export const DURATION_STEP_MINUTES = 15;
export const MAX_DURATION_MINUTES = 24 * 60;

// "45m", "2h", "1h 30m".
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) {
    return `${hours}h`;
  }
  return hours === 0 ? `${rest}m` : `${hours}h ${rest}m`;
}

// Weekly hours arrive as numbers in quarter hours, such as 12.25.
export function formatHours(hours: number) {
  return formatDuration(Math.round(hours * 60));
}

// The same amount read aloud: "1 hour 30 minutes".
export function describeDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (rest > 0 || hours === 0) {
    parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);
  }
  return parts.join(" ");
}
