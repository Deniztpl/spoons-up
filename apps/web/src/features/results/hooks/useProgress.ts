import { useEffect, useState } from "react";

import { getProgress, type AreaResult, type Progress } from "../api/resultsApi";

export function useProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  // Reload whenever something that changes this week's progress was saved.
  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      try {
        const { data } = await getProgress();
        if (cancelled) {
          return;
        }
        if (!data) {
          setLoadError("We couldn't load this week's progress.");
          return;
        }
        setProgress(data);
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      }
    }

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [requestCount]);

  return {
    areas: progress?.areas ?? null,
    areasById: progress
      ? new Map<string, AreaResult>(progress.areas.map((area) => [area.area_id, area]))
      : null,
    loadError,
    reload: () => setRequestCount((count) => count + 1),
  };
}
