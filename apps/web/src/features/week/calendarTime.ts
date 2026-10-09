// Local calendar times as "HH:MM" and the minutes since midnight they stand for.
export const DAY_MINUTES = 24 * 60;

export function timeToMinutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

export function minutesToTime(value: number) {
  const minutes = ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Wraps past midnight the way the API computes a task's end time.
export function endTime(startTime: string | null, durationMinutes: number | null) {
  if (startTime === null || durationMinutes === null) {
    return null;
  }
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}
