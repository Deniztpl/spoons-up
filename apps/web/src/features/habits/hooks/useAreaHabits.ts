import { useEffect, useState } from "react";

import {
  createHabit as createHabitRequest,
  deleteHabit as deleteHabitRequest,
  listHabits,
  updateHabit as updateHabitRequest,
  type Habit,
  type HabitMode,
} from "../api/habitsApi";

type HabitDraft = {
  habitId: string | null;
  savedTitle: string;
  title: string;
  mode: HabitMode;
};

export function useAreaHabits(areaId: string | null) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loadedAreaId, setLoadedAreaId] = useState<string | null>(null);
  const [failedLoad, setFailedLoad] = useState<{ areaId: string; message: string } | null>(
    null,
  );
  const [draft, setDraft] = useState<HabitDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const loadError = failedLoad && failedLoad.areaId === areaId ? failedLoad.message : null;
  const isLoading = areaId !== null && loadedAreaId !== areaId && loadError === null;

  // Reload when the selected area changes.
  useEffect(() => {
    if (areaId === null) {
      return;
    }
    let cancelled = false;

    async function loadHabits(requestedAreaId: string) {
      try {
        const { data, error } = await listHabits(requestedAreaId);
        if (cancelled) {
          return;
        }
        if (!data) {
          setFailedLoad({
            areaId: requestedAreaId,
            message: habitErrorMessage(error, "We couldn't load this area's habits."),
          });
          return;
        }
        setHabits(data.habits);
        setLoadedAreaId(requestedAreaId);
        setFailedLoad((current) => (current?.areaId === requestedAreaId ? null : current));
      } catch {
        if (!cancelled) {
          setFailedLoad({
            areaId: requestedAreaId,
            message: "We couldn't reach Spoons Up. Please try again.",
          });
        }
      }
    }

    void loadHabits(areaId);
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const openForm = (nextDraft: HabitDraft) => {
    setDraft(nextDraft);
    setFormError(null);
    setIsConfirmingDelete(false);
  };

  const closeForm = () => {
    if (isSaving) {
      return;
    }
    setDraft(null);
    setFormError(null);
    setIsConfirmingDelete(false);
  };

  const saveHabit = async () => {
    if (!draft || areaId === null) {
      return;
    }
    const { habitId } = draft;
    setIsSaving(true);
    setFormError(null);
    try {
      const title = draft.title.trim();
      const { data, error } = habitId
        ? await updateHabitRequest(habitId, title, draft.mode)
        : await createHabitRequest(areaId, title, draft.mode);
      if (!data) {
        setFormError(
          habitErrorMessage(
            error,
            habitId ? "We couldn't save this habit." : "We couldn't add this habit.",
          ),
        );
        return;
      }
      setHabits((current) =>
        habitId
          ? current.map((habit) => (habit.id === data.id ? data : habit))
          : [...current, data],
      );
      setDraft(null);
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteHabit = async () => {
    const habitId = draft?.habitId;
    if (!habitId) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const { error, response } = await deleteHabitRequest(habitId);
      if (response.status !== 204) {
        setFormError(habitErrorMessage(error, "We couldn't delete this habit."));
        return;
      }
      setHabits((current) => current.filter((habit) => habit.id !== habitId));
      setDraft(null);
      setIsConfirmingDelete(false);
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    // Hide stale habits while the next area loads.
    habits: areaId !== null && loadedAreaId === areaId ? habits : [],
    isLoading,
    loadError,
    draft,
    formError,
    isSaving,
    isConfirmingDelete,
    openCreate: () => openForm({ habitId: null, savedTitle: "", title: "", mode: "DAILY" }),
    openEdit: (habit: Habit) =>
      openForm({
        habitId: habit.id,
        savedTitle: habit.title,
        title: habit.title,
        mode: habit.mode,
      }),
    closeForm,
    setTitle: (title: string) =>
      setDraft((current) => (current ? { ...current, title } : current)),
    setMode: (mode: HabitMode) =>
      setDraft((current) => (current ? { ...current, mode } : current)),
    saveHabit,
    startDeleting: () => {
      setFormError(null);
      setIsConfirmingDelete(true);
    },
    cancelDeleting: () => setIsConfirmingDelete(false),
    deleteHabit,
  };
}

function habitErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const value = error as {
    code?: unknown;
    message?: unknown;
    fields?: Record<string, unknown>;
  };
  if (value.code === "not_found") {
    return "This habit or its area no longer exists. Reload the page to see the latest list.";
  }
  if (
    value.code === "validation_error" &&
    typeof value.fields?.title === "string"
  ) {
    return value.fields.title;
  }
  return typeof value.message === "string" ? value.message : fallback;
}
