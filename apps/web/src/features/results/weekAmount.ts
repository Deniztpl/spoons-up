import { formatHours } from "../../lib/duration";
import type { Requirement } from "./api/resultsApi";

// Done against target: hours for a goal ("12h 15m/20h"), days or weeks for a habit ("5/7").
export function weekAmount(item: Requirement) {
  return item.ref_type === "GOAL"
    ? `${formatHours(item.done)}/${formatHours(item.target)}`
    : `${item.done}/${item.target}`;
}
