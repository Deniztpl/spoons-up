import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type CreateTaskFields = components["schemas"]["CreateTaskRequest"];
export type UpdateTaskFields = components["schemas"]["UpdateTaskRequest"];

export function createTask(task: CreateTaskFields) {
  return apiClient.POST("/api/v1/tasks", { body: task });
}

export function updateTask(taskId: string, changes: UpdateTaskFields) {
  return apiClient.PATCH("/api/v1/tasks/{task_id}", {
    params: { path: { task_id: taskId } },
    body: changes,
  });
}

export function deleteTask(taskId: string) {
  return apiClient.DELETE("/api/v1/tasks/{task_id}", {
    params: { path: { task_id: taskId } },
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
