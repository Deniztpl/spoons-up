import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Progress = components["schemas"]["ProgressResponse"];
export type AreaResult = components["schemas"]["AreaResultResponse"];
export type Requirement = components["schemas"]["RequirementResponse"];
export type GrowthWeek = components["schemas"]["GrowthWeekResponse"];

export function getProgress() {
  return apiClient.GET("/api/v1/progress");
}

export function getGrowth(before?: string) {
  return apiClient.GET("/api/v1/growth", { params: { query: { before } } });
}
