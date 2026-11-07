import { useEffect, useRef, useState } from "react";

import {
  changeRepeat,
  checkTask,
  createTask,
  deleteTask,
  uncheckTask,
  updateTask,
} from "../../tasks/api/tasksApi";
import { endTime } from "../calendarTime";
import { getToday } from "../../today/api/todayApi";
import { getWeek, type WeekResponse, type WeekTask } from "../api/weekApi";

// Week reaches the current week and the two after it, as far as rules generate tasks.
export const LAST_WEEK_OFFSET = 2;

// Where a task sits on the calendar: its day, its time (null for untimed) and its hours.
export type TaskPlacement = {
  scheduled_date?: string;
  start_time?: string | null;
  duration_minutes?: number;
};

function errorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function addDays(dateValue: string, amount: number) {
  const year = Number(dateValue.slice(0, 4));
  const month = Number(dateValue.slice(5, 7));
  const day = Number(dateValue.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function useWeek() {
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [todayDate, setTodayDate] = useState<string | null>(null);
  // Weeks after the current one: 0 is this week, LAST_WEEK_OFFSET the last one shown.
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    void (async () => {
      try {
        const [weekResult, todayResult] = await Promise.all([getWeek(), getToday()]);
        if (requestId !== requestIdRef.current) return;

        if (weekResult.error || !weekResult.data) {
          setLoadError(errorMessage(weekResult.error, "Week could not be loaded."));
        } else if (todayResult.error || !todayResult.data) {
          setLoadError(errorMessage(todayResult.error, "Today could not be loaded."));
        } else {
          setWeek(weekResult.data);
          setTodayDate(todayResult.data.date);
          setLoadError(null);
        }
      } catch {
        if (requestId === requestIdRef.current) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    })();

    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  async function loadWeek(offset: number, showLoading = true) {
    if (!todayDate || offset < 0 || offset > LAST_WEEK_OFFSET) return;

    const requestId = ++requestIdRef.current;
    if (showLoading) setIsLoading(true);
    try {
      const { data, error } = await getWeek(
        offset === 0 ? undefined : addDays(todayDate, 7 * offset),
      );
      if (requestId !== requestIdRef.current) return;

      if (error || !data) {
        setLoadError(errorMessage(error, "Week could not be loaded."));
      } else {
        setWeek(data);
        setWeekOffset(offset);
        setLoadError(null);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setLoadError("We couldn't reach Spoons Up. Please try again.");
      }
    } finally {
      if (showLoading && requestId === requestIdRef.current) setIsLoading(false);
    }
  }

  function reload() {
    void loadWeek(weekOffset, false);
  }

  async function toggleTask(task: WeekTask) {
    if (pendingTaskIds.has(task.id)) return;

    setActionError(null);
    setPendingTaskIds((current) => new Set(current).add(task.id));

    try {
      const { data, error } =
        task.status === "DONE" ? await uncheckTask(task.id) : await checkTask(task.id);

      if (error || !data) {
        setActionError(errorMessage(error, "Task could not be updated."));
      } else {
        setWeek((current) =>
          current
            ? {
                ...current,
                days: current.days.map((day) => ({
                  ...day,
                  tasks: day.tasks.map((item) =>
                    item.id === task.id
                      ? { ...item, status: data.status === "DONE" ? "DONE" : "PENDING" }
                      : item,
                  ),
                })),
              }
            : current,
        );
      }
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  // Shows a task at a new place before anything is saved, while Week asks how far it reaches.
  function previewPlacement(task: WeekTask, placement: TaskPlacement) {
    setWeek((current) => (current ? withTask(current, placedTask(task, placement)) : current));
  }

  function restoreTask(task: WeekTask) {
    setWeek((current) => (current ? withTask(current, task) : current));
  }

  // The task takes its new place at once; a failed save puts it back where it was. With
  // `repeat` (This and following) the server decides where its sessions end up: the task stays
  // where it was until the week is read again.
  async function placeTask(
    task: WeekTask,
    placement: TaskPlacement,
    scope: "task" | "repeat" = "task",
  ) {
    if (pendingTaskIds.has(task.id)) return;

    const placed = placedTask(task, placement);
    setActionError(null);
    setPendingTaskIds((current) => new Set(current).add(task.id));
    setWeek((current) =>
      current ? withTask(current, scope === "repeat" ? task : placed) : current,
    );

    try {
      const { error } =
        scope === "repeat"
          ? await changeRepeat(task.id, {
              scheduled_date: placed.scheduled_date,
              start_time: placed.start_time,
              duration_minutes: placed.duration_minutes ?? 60,
            })
          : await updateTask(task.id, placement);
      if (error) {
        setWeek((current) => (current ? withTask(current, task) : current));
        setActionError(errorMessage(error, "Task could not be moved."));
      } else {
        // A move can change other numbers, such as the week's hours, so read the week again.
        await loadWeek(weekOffset, false);
      }
    } catch {
      setWeek((current) => (current ? withTask(current, task) : current));
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  // A copy is new work at the spot with the same hours: goal work stays with its goal and does
  // not repeat; Journal work becomes a new item with only its title.
  async function pasteTask(task: WeekTask, spot: { date: string; startTime: string | null }) {
    setActionError(null);
    try {
      const { data, error } = await createTask({
        ...(task.goal_id ? { goal_id: task.goal_id } : { title: task.title }),
        scheduled_date: spot.date,
        start_time: spot.startTime,
        duration_minutes: task.duration_minutes,
      });
      if (!data) {
        setActionError(errorMessage(error, "Task could not be pasted."));
        return;
      }
      await loadWeek(weekOffset, false);
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    }
  }

  // The task leaves the calendar at once; a failed delete puts it back.
  async function removeTask(task: WeekTask, scope: "task" | "repeat" = "task") {
    if (pendingTaskIds.has(task.id)) return;

    setActionError(null);
    setPendingTaskIds((current) => new Set(current).add(task.id));
    setWeek((current) => (current ? withoutTask(current, task.id) : current));

    try {
      const { error, response } = await deleteTask(task.id, scope);
      if (response.status !== 204) {
        setWeek((current) => (current ? withTask(current, task) : current));
        setActionError(errorMessage(error, "Task could not be deleted."));
      } else {
        await loadWeek(weekOffset, false);
      }
    } catch {
      setWeek((current) => (current ? withTask(current, task) : current));
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  return {
    week,
    todayDate,
    weekOffset,
    isLoading,
    loadError,
    actionError,
    pendingTaskIds,
    showCurrentWeek: () => void loadWeek(0),
    showPreviousWeek: () => void loadWeek(weekOffset - 1),
    showNextWeek: () => void loadWeek(weekOffset + 1),
    reload,
    toggleTask,
    previewPlacement,
    restoreTask,
    placeTask,
    pasteTask,
    removeTask,
  };

}

function placedTask(task: WeekTask, placement: TaskPlacement): WeekTask {
  const placed = { ...task, ...placement };
  return { ...placed, end_time: endTime(placed.start_time, placed.duration_minutes) };
}

function withoutTask(week: WeekResponse, taskId: string): WeekResponse {
  return {
    ...week,
    days: week.days.map((day) => ({
      ...day,
      tasks: day.tasks.filter((item) => item.id !== taskId),
    })),
  };
}

// The week with the task shown on its own day, wherever it was before.
function withTask(week: WeekResponse, task: WeekTask): WeekResponse {
  return {
    ...week,
    days: week.days.map((day) => {
      const others = day.tasks.filter((item) => item.id !== task.id);
      return { ...day, tasks: day.date === task.scheduled_date ? [...others, task] : others };
    }),
  };
}
