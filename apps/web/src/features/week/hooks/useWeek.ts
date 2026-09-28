import { useEffect, useRef, useState } from "react";

import { checkTask, uncheckTask, updateTask } from "../../tasks/api/tasksApi";
import { getToday } from "../../today/api/todayApi";
import { getWeek, type WeekResponse, type WeekTask } from "../api/weekApi";

export type WeekPosition = "current" | "following";

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
  const [position, setPosition] = useState<WeekPosition>("current");
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

  async function loadWeek(target: WeekPosition, showLoading = true) {
    if (!todayDate) return;

    const requestId = ++requestIdRef.current;
    if (showLoading) setIsLoading(true);
    try {
      const { data, error } = await getWeek(
        target === "following" ? addDays(todayDate, 7) : undefined,
      );
      if (requestId !== requestIdRef.current) return;

      if (error || !data) {
        setLoadError(errorMessage(error, "Week could not be loaded."));
      } else {
        setWeek(data);
        setPosition(target);
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
    void loadWeek(position, false);
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

  async function moveTask(task: WeekTask, scheduledDate: string, startTime: string | null) {
    if (pendingTaskIds.has(task.id)) return;
    if (task.scheduled_date === scheduledDate && task.start_time === startTime) return;

    setActionError(null);
    setPendingTaskIds((current) => new Set(current).add(task.id));

    try {
      const { error } = await updateTask(task.id, {
        scheduled_date: scheduledDate,
        start_time: startTime,
      });

      if (error) {
        setActionError(errorMessage(error, "Task could not be moved."));
      } else {
        await loadWeek(position, false);
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

  return {
    week,
    todayDate,
    position,
    isLoading,
    loadError,
    actionError,
    pendingTaskIds,
    showCurrentWeek: () => void loadWeek("current"),
    showFollowingWeek: () => void loadWeek("following"),
    reload,
    toggleTask,
    moveTask,
  };
}
