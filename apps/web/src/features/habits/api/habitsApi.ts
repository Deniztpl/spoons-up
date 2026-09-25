import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Habit = components["schemas"]["HabitResponse"];
export type HabitMode = components["schemas"]["HabitMode"];

export function listHabits(areaId: string) {
  return apiClient.GET("/api/v1/habits", {
    params: { query: { area_id: areaId } },
  });
}

export function createHabit(areaId: string, title: string, mode: HabitMode) {
  return apiClient.POST("/api/v1/habits", {
    body: { area_id: areaId, title, mode },
  });
}

export function updateHabit(habitId: string, title: string, mode: HabitMode) {
  return apiClient.PATCH("/api/v1/habits/{habit_id}", {
    params: { path: { habit_id: habitId } },
    body: { title, mode },
  });
}

export function deleteHabit(habitId: string) {
  return apiClient.DELETE("/api/v1/habits/{habit_id}", {
    params: { path: { habit_id: habitId } },
  });
}

export function checkHabit(habitId: string, date: string) {
  return apiClient.POST("/api/v1/habits/{habit_id}/check", {
    params: { path: { habit_id: habitId } },
    body: { date },
  });
}

export function uncheckHabit(habitId: string, date: string) {
  return apiClient.DELETE("/api/v1/habits/{habit_id}/check", {
    params: { path: { habit_id: habitId }, query: { date } },
  });
}
