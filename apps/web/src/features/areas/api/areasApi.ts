import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Area = components["schemas"]["AreaResponse"];

export function listAreas() {
  return apiClient.GET("/api/v1/areas", {
    params: { query: { include_archived: true } },
  });
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

export function setAreaArchived(areaId: string, archived: boolean) {
  return apiClient.POST("/api/v1/areas/{area_id}/archive", {
    params: { path: { area_id: areaId } },
    body: { archived },
  });
}

export function deleteArea(areaId: string) {
  return apiClient.DELETE("/api/v1/areas/{area_id}", {
    params: { path: { area_id: areaId } },
  });
}
