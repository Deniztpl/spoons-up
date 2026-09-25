import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Today = components["schemas"]["TodayResponse"];
export type TodayHabit = components["schemas"]["TodayHabitResponse"];

export function getToday() {
  return apiClient.GET("/api/v1/today");
}
