import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type WeekResponse = components["schemas"]["WeekResponse"];
export type WeekTask = components["schemas"]["TodayTaskResponse"];
export type LaterTask = components["schemas"]["LaterTaskResponse"];

export async function getWeek(start?: string) {
  return apiClient.GET("/api/v1/week", {
    params: {
      query: start ? { start } : {},
    },
  });
}
