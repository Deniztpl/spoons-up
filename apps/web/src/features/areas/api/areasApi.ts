import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Area = components["schemas"]["AreaResponse"];

export function listAreas() {
  return apiClient.GET("/api/v1/areas");
}

export function createArea(name: string) {
  return apiClient.POST("/api/v1/areas", { body: { name } });
}

export function renameArea(areaId: string, name: string) {
  return apiClient.PATCH("/api/v1/areas/{area_id}", {
    params: { path: { area_id: areaId } },
    body: { name },
  });
}
