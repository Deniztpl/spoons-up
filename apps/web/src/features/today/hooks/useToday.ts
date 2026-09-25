import { useEffect, useState } from "react";

import { checkHabit, uncheckHabit } from "../../habits/api/habitsApi";
import { getToday, type Today, type TodayHabit } from "../api/todayApi";

export function useToday() {
  const [today, setToday] = useState<Today | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingHabitIds, setPendingHabitIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Load the server-defined current day.
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
  }, []);

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
          setActionError(todayErrorMessage(error, `We couldn't check off ${habit.title}.`));
          return;
        }
      } else {
        const { error, response } = await uncheckHabit(habit.id, today.date);
        if (response.status !== 204) {
          setActionError(todayErrorMessage(error, `We couldn't undo ${habit.title}.`));
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

  return {
    today,
    isLoading,
    loadError,
    pendingHabitIds,
    actionError,
    toggleHabit,
  };
}

function todayErrorMessage(error: unknown, fallback: string) {
  if (errorCode(error) === "not_found") {
    return "This habit no longer exists. Reload the page to see the latest list.";
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
