import { useEffect, useState } from "react";

import { checkHabit, uncheckHabit } from "../../habits/api/habitsApi";
import { checkTask, uncheckTask } from "../../tasks/api/tasksApi";
import { getToday, type Today, type TodayHabit, type TodayTask } from "../api/todayApi";

const missingHabitMessage = "This habit no longer exists. Reload the page to see the latest list.";
const missingTaskMessage = "This task no longer exists. Reload the page to see the latest list.";

export function useToday() {
  const [today, setToday] = useState<Today | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [pendingHabitIds, setPendingHabitIds] = useState<string[]>([]);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load the server-defined current day, and again after changes made elsewhere.
  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      try {
        const { data, error } = await getToday();
        if (cancelled) {
          return;
        }
        if (!data) {
          setLoadError(todayErrorMessage(error, "We couldn't load today."));
          return;
        }
        setToday(data);
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadToday();
    return () => {
      cancelled = true;
    };
  }, [loadCount]);

  // Keep daily and weekly views in sync.
  const setHabitDone = (habitId: string, done: boolean) => {
    const update = (habits: TodayHabit[]) =>
      habits.map((habit) => (habit.id === habitId ? { ...habit, done } : habit));
    setToday((current) =>
      current
        ? {
            ...current,
            daily_habits: update(current.daily_habits),
            weekly_habits: update(current.weekly_habits),
          }
        : current,
    );
  };

  const toggleHabit = async (habit: TodayHabit) => {
    if (!today || pendingHabitIds.includes(habit.id)) {
      return;
    }
    const done = !habit.done;
    setPendingHabitIds((current) => [...current, habit.id]);
    setActionError(null);
    try {
      // Let the API resolve the habit period.
      if (done) {
        const { data, error } = await checkHabit(habit.id, today.date);
        if (!data && errorCode(error) !== "already_checked") {
          setActionError(
            todayErrorMessage(error, `We couldn't check off ${habit.title}.`, missingHabitMessage),
          );
          return;
        }
      } else {
        const { error, response } = await uncheckHabit(habit.id, today.date);
        if (response.status !== 204) {
          setActionError(
            todayErrorMessage(error, `We couldn't undo ${habit.title}.`, missingHabitMessage),
          );
          return;
        }
      }
      setHabitDone(habit.id, done);
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingHabitIds((current) => current.filter((id) => id !== habit.id));
    }
  };

  const toggleTask = async (task: TodayTask) => {
    if (pendingTaskIds.includes(task.id)) {
      return;
    }
    const done = task.status !== "DONE";
    setPendingTaskIds((current) => [...current, task.id]);
    setActionError(null);
    try {
      const { data, error } = done ? await checkTask(task.id) : await uncheckTask(task.id);
      if (!data) {
        setActionError(
          todayErrorMessage(
            error,
            done ? `We couldn't complete ${task.title}.` : `We couldn't undo ${task.title}.`,
            missingTaskMessage,
          ),
        );
        return;
      }
      const status = data.status === "DONE" ? "DONE" : "PENDING";
      setToday((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((item) => (item.id === data.id ? { ...item, status } : item)),
            }
          : current,
      );
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingTaskIds((current) => current.filter((id) => id !== task.id));
    }
  };

  return {
    today,
    isLoading,
    loadError,
    pendingHabitIds,
    pendingTaskIds,
    actionError,
    reload: () => setLoadCount((count) => count + 1),
    toggleHabit,
    toggleTask,
  };
}

function todayErrorMessage(error: unknown, fallback: string, notFoundMessage = fallback) {
  if (errorCode(error) === "not_found") {
    return notFoundMessage;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return typeof error.message === "string" ? error.message : fallback;
  }
  return fallback;
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined;
}
