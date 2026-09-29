import type { Requirement } from "./api/resultsApi";

// "1½/4": done against target, with half blocks written as ½.
export function weekAmount(item: Requirement) {
  return `${formatAmount(item.done)}/${formatAmount(item.target)}`;
}

function formatAmount(value: number) {
  const whole = Math.floor(value);
  return value - whole === 0.5 ? `${whole === 0 ? "" : whole}½` : String(value);
}
