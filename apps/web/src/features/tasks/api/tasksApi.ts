import { apiClient } from "../../../lib/api";

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
