import { useEffect, useState } from "react";

import { listGoals } from "../../goals/api/goalsApi";
import { type Area, listActiveAreas } from "../api/areasApi";

type AreaLookup = {
  areaById: ReadonlyMap<string, Area>;
  areaByGoalId: ReadonlyMap<string, Area>;
};

const emptyLookup: AreaLookup = { areaById: new Map(), areaByGoalId: new Map() };

// Finds the area behind a habit or a goal task, for its colour and name.
export function useAreaLookup() {
  const [lookup, setLookup] = useState(emptyLookup);

  useEffect(() => {
    let cancelled = false;

    async function loadLookup() {
      try {
        const [areaResult, goalResult] = await Promise.all([listActiveAreas(), listGoals()]);
        if (cancelled || !areaResult.data || !goalResult.data) {
          return;
        }
        const areaById = new Map(areaResult.data.areas.map((area) => [area.id, area]));
        const areaByGoalId = new Map<string, Area>();
        for (const goal of goalResult.data.goals) {
          const area = areaById.get(goal.area_id);
          if (area) {
            areaByGoalId.set(goal.id, area);
          }
        }
        setLookup({ areaById, areaByGoalId });
      } catch {
        // Colours only decorate; items keep the accent when this cannot load.
      }
    }

    void loadLookup();
    return () => {
      cancelled = true;
    };
  }, []);

  return lookup;
}
