import { useRef, useState } from "react";

import { listActiveAreas, type Area } from "../../areas/api/areasApi";
import {
  createGoal as createGoalRequest,
  createGoalRule,
  deleteGoal as deleteGoalRequest,
  deleteGoalRule,
  updateGoal as updateGoalRequest,
  updateGoalRule,
  type Goal,
  type GoalChanges,
  type GoalRule,
  type GoalRuleChanges,
  type GoalRuleFields,
} from "../api/goalsApi";

export type GoalRuleValues = {
  byweekday: number[];
  startTime: string | null;
  durationMinutes: number | null;
  blockCount: number | null;
};

export type GoalRuleDraft = GoalRuleValues & {
  key: string;
  ruleId: string | null;
};

export type GoalDraft = {
  // The goal as the server last confirmed it; null until it is created.
  saved: Goal | null;
  areaId: string;
  title: string;
  weeklyTarget: string;
  rules: GoalRuleDraft[];
};

export type GoalAreaOptions = {
  areas: Area[] | null;
  loadError: string | null;
};

type GoalFormCallbacks = {
  onSaved: (goal: Goal) => void;
  onDeleted: (goalId: string) => void;
};

let lastRuleKey = 0;

export function useGoalForm({ onSaved, onDeleted }: GoalFormCallbacks) {
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [areaOptions, setAreaOptions] = useState<GoalAreaOptions | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const areaRequest = useRef(0);

  const openForm = (nextDraft: GoalDraft, nextAreaOptions: GoalAreaOptions | null) => {
    areaRequest.current += 1;
    setDraft(nextDraft);
    setAreaOptions(nextAreaOptions);
    setFormError(null);
    setIsConfirmingDelete(false);
  };

  // Offer the active areas when the form is not opened from one.
  const loadAreaOptions = async () => {
    const request = areaRequest.current;
    try {
      const { data, error } = await listActiveAreas();
      if (request !== areaRequest.current) {
        return;
      }
      if (!data) {
        setAreaOptions({
          areas: null,
          loadError: goalErrorMessage(error, "We couldn't load your areas."),
        });
        return;
      }
      setAreaOptions({ areas: data.areas, loadError: null });
      const onlyArea = data.areas.length === 1 ? data.areas[0] : undefined;
      if (onlyArea) {
        setDraft((current) =>
          current && current.areaId === "" ? { ...current, areaId: onlyArea.id } : current,
        );
      }
    } catch {
      if (request === areaRequest.current) {
        setAreaOptions({
          areas: null,
          loadError: "We couldn't reach Spoons Up. Please try again.",
        });
      }
    }
  };

  const openCreate = (areaId: string | null) => {
    openForm(
      { saved: null, areaId: areaId ?? "", title: "", weeklyTarget: "", rules: [] },
      areaId === null ? { areas: null, loadError: null } : null,
    );
    if (areaId === null) {
      void loadAreaOptions();
    }
  };

  const openEdit = (goal: Goal) =>
    openForm(
      {
        saved: goal,
        areaId: goal.area_id,
        title: goal.title,
        weeklyTarget: goal.weekly_target === null ? "" : String(goal.weekly_target),
        rules: goal.rules.map(savedRule),
      },
      null,
    );

  const closeForm = () => {
    if (isSaving) {
      return;
    }
    areaRequest.current += 1;
    setDraft(null);
    setAreaOptions(null);
    setFormError(null);
    setIsConfirmingDelete(false);
  };

  const updateDraft = (update: (current: GoalDraft) => GoalDraft) =>
    setDraft((current) => (current ? update(current) : current));

  const saveGoal = async () => {
    if (!draft || isSaving || !isGoalDraftComplete(draft)) {
      return;
    }
    const { areaId, rules } = draft;
    const title = draft.title.trim();
    const weeklyTarget = draft.weeklyTarget === "" ? null : Number(draft.weeklyTarget);
    const createdRuleIds = new Map<string, string>();
    let goal = draft.saved;
    let isComplete = false;
    setIsSaving(true);
    setFormError(null);

    // Keep every confirmed step, so a retry sends only what is still missing.
    try {
      if (goal === null) {
        const { data, error } = await createGoalRequest(areaId, title, weeklyTarget);
        if (!data) {
          setFormError(goalErrorMessage(error, "We couldn't add this goal."));
          return;
        }
        goal = data;
      } else {
        const changes = goalChanges(goal, title, weeklyTarget);
        if (changes) {
          const { data, error } = await updateGoalRequest(goal.id, changes);
          if (!data) {
            setFormError(goalErrorMessage(error, "We couldn't save this goal."));
            return;
          }
          goal = data;
        }
      }

      const keptRuleIds = new Set(rules.map((rule) => rule.ruleId));
      for (const removed of goal.rules.filter((rule) => !keptRuleIds.has(rule.id))) {
        const { error, response } = await deleteGoalRule(removed.id);
        if (response.status !== 204) {
          setFormError(goalErrorMessage(error, "We couldn't remove a rule."));
          return;
        }
        goal = { ...goal, rules: goal.rules.filter((rule) => rule.id !== removed.id) };
      }

      // A rule write redraws that rule's pending tasks, so unchanged rules are left alone.
      for (const rule of rules) {
        const current = goal.rules.find((item) => item.id === rule.ruleId);
        if (!current) {
          const { data, error } = await createGoalRule(goal.id, ruleFields(rule));
          if (!data) {
            setFormError(goalErrorMessage(error, "We couldn't add a rule."));
            return;
          }
          goal = { ...goal, rules: [...goal.rules, data] };
          createdRuleIds.set(rule.key, data.id);
          continue;
        }
        const changes = ruleChanges(rule, current);
        if (changes) {
          const { data, error } = await updateGoalRule(current.id, changes);
          if (!data) {
            setFormError(goalErrorMessage(error, "We couldn't save a rule."));
            return;
          }
          goal = {
            ...goal,
            rules: goal.rules.map((item) => (item.id === data.id ? data : item)),
          };
        }
      }
      isComplete = true;
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      if (goal !== null && goal !== draft.saved) {
        onSaved(goal);
      }
      if (isComplete) {
        setDraft(null);
        setAreaOptions(null);
      } else if (goal !== null) {
        const saved = goal;
        updateDraft((current) => ({
          ...current,
          saved,
          rules: current.rules.map((rule) => {
            const ruleId = createdRuleIds.get(rule.key);
            return ruleId ? { ...rule, ruleId } : rule;
          }),
        }));
      }
      setIsSaving(false);
    }
  };

  const deleteGoal = async () => {
    const goalId = draft?.saved?.id;
    if (!goalId || isSaving) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const { error, response } = await deleteGoalRequest(goalId);
      if (response.status !== 204) {
        setFormError(goalErrorMessage(error, "We couldn't delete this goal."));
        return;
      }
      onDeleted(goalId);
      setDraft(null);
      setAreaOptions(null);
      setIsConfirmingDelete(false);
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    draft,
    areaOptions,
    formError,
    isSaving,
    isConfirmingDelete,
    openCreate,
    openEdit,
    closeForm,
    setAreaId: (areaId: string) => updateDraft((current) => ({ ...current, areaId })),
    setTitle: (title: string) => updateDraft((current) => ({ ...current, title })),
    setWeeklyTarget: (weeklyTarget: string) =>
      updateDraft((current) => ({ ...current, weeklyTarget })),
    setRepeating: (isRepeating: boolean) =>
      updateDraft((current) => ({
        ...current,
        rules: isRepeating
          ? current.rules.length > 0
            ? current.rules
            : [newRule()]
          : [],
      })),
    addRule: () => {
      const rule = newRule();
      updateDraft((current) => ({ ...current, rules: [...current.rules, rule] }));
    },
    changeRule: (key: string, changes: Partial<GoalRuleValues>) =>
      updateDraft((current) => ({
        ...current,
        rules: current.rules.map((rule) => (rule.key === key ? { ...rule, ...changes } : rule)),
      })),
    removeRule: (key: string) =>
      updateDraft((current) => ({
        ...current,
        rules: current.rules.filter((rule) => rule.key !== key),
      })),
    saveGoal,
    startDeleting: () => {
      setFormError(null);
      setIsConfirmingDelete(true);
    },
    cancelDeleting: () => setIsConfirmingDelete(false),
    deleteGoal,
  };
}

export function isGoalDraftComplete(draft: GoalDraft) {
  return (
    draft.title.trim().length > 0 &&
    draft.areaId !== "" &&
    draft.rules.every((rule) => rule.byweekday.length > 0)
  );
}

export function goalErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const value = error as {
    code?: unknown;
    message?: unknown;
    fields?: Record<string, unknown>;
  };
  if (value.code === "not_found") {
    return "This goal or its area no longer exists. Reload the page to see the latest list.";
  }
  if (
    value.code === "validation_error" &&
    typeof value.fields?.title === "string"
  ) {
    return value.fields.title;
  }
  return typeof value.message === "string" ? value.message : fallback;
}

function newRule(): GoalRuleDraft {
  lastRuleKey += 1;
  return {
    key: `new-${lastRuleKey}`,
    ruleId: null,
    byweekday: [],
    startTime: "09:00",
    durationMinutes: 60,
    blockCount: 1,
  };
}

function savedRule(rule: GoalRule): GoalRuleDraft {
  return {
    key: `rule-${rule.id}`,
    ruleId: rule.id,
    byweekday: rule.byweekday,
    startTime: rule.start_time,
    durationMinutes: rule.duration_minutes,
    blockCount: rule.block_count,
  };
}

function ruleFields(rule: GoalRuleDraft): GoalRuleFields {
  return {
    byweekday: rule.byweekday,
    start_time: rule.startTime,
    duration_minutes: rule.durationMinutes,
    block_count: rule.blockCount,
  };
}

function goalChanges(goal: Goal, title: string, weeklyTarget: number | null) {
  const changes: GoalChanges = {};
  if (title !== goal.title) {
    changes.title = title;
  }
  if (weeklyTarget !== goal.weekly_target) {
    changes.weekly_target = weeklyTarget;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

function ruleChanges(rule: GoalRuleDraft, saved: GoalRule) {
  const changes: GoalRuleChanges = {};
  if (rule.byweekday.join() !== saved.byweekday.join()) {
    changes.byweekday = rule.byweekday;
  }
  if (rule.startTime !== saved.start_time) {
    changes.start_time = rule.startTime;
  }
  if (rule.durationMinutes !== saved.duration_minutes) {
    changes.duration_minutes = rule.durationMinutes;
  }
  if (rule.blockCount !== saved.block_count) {
    changes.block_count = rule.blockCount;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
