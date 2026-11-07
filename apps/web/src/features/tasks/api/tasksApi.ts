import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type CreateTaskFields = components["schemas"]["CreateTaskRequest"];
export type UpdateTaskFields = components["schemas"]["UpdateTaskRequest"];
export type ChangeRepeatFields = components["schemas"]["ChangeRepeatRequest"];

export function createTask(task: CreateTaskFields) {
  return apiClient.POST("/api/v1/tasks", { body: task });
}

export function updateTask(taskId: string, changes: UpdateTaskFields) {
  return apiClient.PATCH("/api/v1/tasks/{task_id}", {
    params: { path: { task_id: taskId } },
    body: changes,
  });
}

// `repeat` is Week's This and following: the later sessions go too and the schedule ends.
export function deleteTask(taskId: string, scope: "task" | "repeat" = "task") {
  return apiClient.DELETE("/api/v1/tasks/{task_id}", {
    params: { path: { task_id: taskId }, query: scope === "repeat" ? { scope } : undefined },
  });
}

// This and following: the task's session and the later ones take the drop's time and length.
export function changeRepeat(taskId: string, fields: ChangeRepeatFields) {
  return apiClient.PATCH("/api/v1/tasks/{task_id}/repeat", {
    params: { path: { task_id: taskId } },
    body: fields,
  });
}

export function checkTask(taskId: string) {
  return apiClient.POST("/api/v1/tasks/{task_id}/check", {
    params: { path: { task_id: taskId } },
  });
}

export function uncheckTask(taskId: string) {
  return apiClient.DELETE("/api/v1/tasks/{task_id}/check", {
    params: { path: { task_id: taskId } },
  });
}

export function repeatTask(taskId: string, byweekday: number[]) {
  return apiClient.POST("/api/v1/tasks/{task_id}/repeat", {
    params: { path: { task_id: taskId } },
    body: { byweekday },
  });
}

export function stopRepeatingTask(taskId: string) {
  return apiClient.DELETE("/api/v1/tasks/{task_id}/repeat", {
    params: { path: { task_id: taskId } },
  });
}
