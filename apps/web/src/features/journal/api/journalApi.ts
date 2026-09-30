import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Journal = components["schemas"]["JournalResponse"];
export type JournalItem = components["schemas"]["JournalItemResponse"];
export type JournalStep = components["schemas"]["JournalStepResponse"];

export function getJournal() {
  return apiClient.GET("/api/v1/journal");
}
