import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Today = components["schemas"]["TodayResponse"];
export type TodayHabit = components["schemas"]["TodayHabitResponse"];
export type TodayTask = components["schemas"]["TodayTaskResponse"];
export type LeftBehindItem = components["schemas"]["LeftBehindItemResponse"];

export function getToday() {
  return apiClient.GET("/api/v1/today");
}
