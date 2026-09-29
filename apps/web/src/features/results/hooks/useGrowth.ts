import { useEffect, useState } from "react";

import { getGrowth, type GrowthWeek } from "../api/resultsApi";

export function useGrowth() {
  const [weeks, setWeeks] = useState<GrowthWeek[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGrowth() {
      try {
        const { data } = await getGrowth();
        if (cancelled) {
          return;
        }
        if (!data) {
          setLoadError("We couldn't load your past weeks.");
          return;
        }
        setWeeks(data.weeks);
        setHasMore(data.has_more);
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      }
    }

    void loadGrowth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Each page continues from the oldest week already shown.
  const loadMore = async () => {
    const oldestWeek = weeks?.[weeks.length - 1];
    if (!oldestWeek || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const { data } = await getGrowth(oldestWeek.period_start);
      if (!data) {
        setLoadError("We couldn't load older weeks.");
        return;
      }
      setWeeks((current) => [...(current ?? []), ...data.weeks]);
      setHasMore(data.has_more);
    } catch {
      setLoadError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return { weeks, hasMore, isLoadingMore, loadError, loadMore };
}
