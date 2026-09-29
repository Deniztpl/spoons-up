import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Progress = components["schemas"]["ProgressResponse"];
export type AreaResult = components["schemas"]["AreaResultResponse"];
export type Requirement = components["schemas"]["RequirementResponse"];

export function getProgress() {
  return apiClient.GET("/api/v1/progress");
}
