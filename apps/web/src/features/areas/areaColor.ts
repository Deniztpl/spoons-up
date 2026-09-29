import type { Area } from "./api/areasApi";

// The class that gives an item its area's --area colours from styles.css.
export function areaColorClass(area: Pick<Area, "color"> | null | undefined) {
  return area?.color ? `area-${area.color.toLowerCase()}` : "";
}
