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

// What a planned start and duration come to: "Ends 21:00", "Ends 01:00 next day", or "Untimed"
// for work with no start time. Nothing to say when there is a time but no duration.
export function planEndLabel(startTime: string | null, minutes: number | null) {
  if (!startTime) {
    return "Untimed";
  }
  if (minutes === null) {
    return null;
  }
  const dayMinutes = 24 * 60;
  const total = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) + minutes;
  const end = total % dayMinutes;
  const time = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return total >= dayMinutes ? `Ends ${time} next day` : `Ends ${time}`;
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
