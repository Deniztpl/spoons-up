import { useEffect, useState } from "react";

import { listGoals, type Goal } from "../api/goalsApi";
import { goalErrorMessage, useGoalForm } from "./useGoalForm";

export function useAreaGoals(areaId: string | null) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadedAreaId, setLoadedAreaId] = useState<string | null>(null);
  const [failedLoad, setFailedLoad] = useState<{ areaId: string; message: string } | null>(
    null,
  );
  const goalForm = useGoalForm({
    onSaved: (goal) =>
      setGoals((current) =>
        current.some((item) => item.id === goal.id)
          ? current.map((item) => (item.id === goal.id ? goal : item))
          : [...current, goal],
      ),
    onDeleted: (goalId) =>
      setGoals((current) => current.filter((goal) => goal.id !== goalId)),
  });

  const loadError = failedLoad && failedLoad.areaId === areaId ? failedLoad.message : null;
  const isLoading = areaId !== null && loadedAreaId !== areaId && loadError === null;

  // Reload when the selected area changes.
  useEffect(() => {
    if (areaId === null) {
      return;
    }
    let cancelled = false;

    async function loadGoals(requestedAreaId: string) {
      try {
        const { data, error } = await listGoals(requestedAreaId);
        if (cancelled) {
          return;
        }
        if (!data) {
          setFailedLoad({
            areaId: requestedAreaId,
            message: goalErrorMessage(error, "We couldn't load this area's goals."),
          });
          return;
        }
        setGoals(data.goals);
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

    void loadGoals(areaId);
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  return {
    ...goalForm,
    // Hide stale goals while the next area loads.
    goals: areaId !== null && loadedAreaId === areaId ? goals : [],
    isLoading,
    loadError,
    openCreate: () => {
      if (areaId !== null) {
        goalForm.openCreate(areaId);
      }
    },
  };
}
