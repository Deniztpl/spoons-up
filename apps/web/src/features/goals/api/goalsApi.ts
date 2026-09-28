import type { components } from "@spoons-up/api-client";

import { apiClient } from "../../../lib/api";

export type Goal = components["schemas"]["GoalResponse"];
export type GoalRule = components["schemas"]["GoalRuleResponse"];
export type GoalChanges = components["schemas"]["UpdateGoalRequest"];
export type GoalRuleFields = components["schemas"]["CreateGoalRuleRequest"];
export type GoalRuleChanges = components["schemas"]["UpdateGoalRuleRequest"];

export function listGoals(areaId?: string) {
  return apiClient.GET("/api/v1/goals", {
    params: { query: areaId ? { area_id: areaId } : {} },
  });
}

export function getGoal(goalId: string) {
  return apiClient.GET("/api/v1/goals/{goal_id}", {
    params: { path: { goal_id: goalId } },
  });
}

export function createGoal(areaId: string, title: string, weeklyTarget: number | null) {
  return apiClient.POST("/api/v1/goals", {
    body: { area_id: areaId, title, weekly_target: weeklyTarget },
  });
}

export function updateGoal(goalId: string, changes: GoalChanges) {
  return apiClient.PATCH("/api/v1/goals/{goal_id}", {
    params: { path: { goal_id: goalId } },
    body: changes,
  });
}

export function deleteGoal(goalId: string) {
  return apiClient.DELETE("/api/v1/goals/{goal_id}", {
    params: { path: { goal_id: goalId } },
  });
}

export function createGoalRule(goalId: string, rule: GoalRuleFields) {
  return apiClient.POST("/api/v1/goals/{goal_id}/rules", {
    params: { path: { goal_id: goalId } },
    body: rule,
  });
}

export function updateGoalRule(ruleId: string, changes: GoalRuleChanges) {
  return apiClient.PATCH("/api/v1/rules/{rule_id}", {
    params: { path: { rule_id: ruleId } },
    body: changes,
  });
}

export function deleteGoalRule(ruleId: string) {
  return apiClient.DELETE("/api/v1/rules/{rule_id}", {
    params: { path: { rule_id: ruleId } },
  });
}
