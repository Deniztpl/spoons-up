import { useRef, useState } from "react";

import { listActiveAreas, type Area } from "../../areas/api/areasApi";
import {
  createGoalRule,
  getGoal,
  listGoals,
  updateGoalRule,
  type Goal,
} from "../../goals/api/goalsApi";
import {
  createTask,
  deleteTask,
  repeatTask,
  stopRepeatingTask,
  updateTask,
  type UpdateTaskFields,
} from "../api/tasksApi";

export type EditableTask = {
  id: string;
  goal_id: string | null;
  rule_id: string | null;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  block_count: number | null;
};

export type TaskDraft = {
  task: EditableTask | null;
  scheduledDate: string;
  goalId: string;
  title: string;
  startTime: string;
  durationMinutes: string;
  blockCount: string;
  isRepeating: boolean;
  byweekday: number[];
  savedWeekdays: number[] | null;
};

type TaskFormCallbacks = {
  onSaved: () => void;
  onDeleted: () => void;
};

export type NewTaskDefaults = {
  scheduledDate: string;
  startTime?: string;
};

export function useTaskForm({ onSaved, onDeleted }: TaskFormCallbacks) {
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const formRequest = useRef(0);

  const updateDraft = (update: (current: TaskDraft) => TaskDraft) =>
    setDraft((current) => (current ? update(current) : current));

  const loadOptions = async (request: number) => {
    try {
      const [areaResult, goalResult] = await Promise.all([listActiveAreas(), listGoals()]);
      if (request !== formRequest.current) {
        return;
      }
      if (!areaResult.data) {
        setOptionsError(taskErrorMessage(areaResult.error, "We couldn't load your areas."));
        return;
      }
      if (!goalResult.data) {
        setOptionsError(taskErrorMessage(goalResult.error, "We couldn't load your goals."));
        return;
      }
      setAreas(areaResult.data.areas);
      setGoals(goalResult.data.goals);
    } catch {
      if (request === formRequest.current) {
        setOptionsError("We couldn't reach Spoons Up. Please try again.");
      }
    }
  };

  const loadSchedule = async (task: EditableTask, request: number) => {
    if (!task.goal_id || !task.rule_id) {
      return;
    }
    try {
      const { data, error } = await getGoal(task.goal_id);
      if (request !== formRequest.current) {
        return;
      }
      const rule = data?.rules.find((item) => item.id === task.rule_id);
      if (!rule) {
        setOptionsError(taskErrorMessage(error, "We couldn't load this task's schedule."));
        return;
      }
      updateDraft((current) =>
        current.task?.id === task.id
          ? { ...current, byweekday: rule.byweekday, savedWeekdays: rule.byweekday }
          : current,
      );
    } catch {
      if (request === formRequest.current) {
        setOptionsError("We couldn't reach Spoons Up. Please try again.");
      }
    }
  };

  const openCreate = ({ scheduledDate, startTime = "" }: NewTaskDefaults) => {
    formRequest.current += 1;
    setDraft({
      task: null,
      scheduledDate,
      goalId: "",
      title: "",
      startTime,
      durationMinutes: "",
      blockCount: "",
      isRepeating: false,
      byweekday: [],
      savedWeekdays: [],
    });
    setAreas(null);
    setGoals(null);
    setOptionsError(null);
    setFormError(null);
    setIsConfirmingDelete(false);
    void loadOptions(formRequest.current);
  };

  const openEdit = (task: EditableTask) => {
    formRequest.current += 1;
    setDraft({
      task,
      scheduledDate: task.scheduled_date,
      goalId: task.goal_id ?? "",
      title: task.title,
      startTime: task.start_time ?? "",
      durationMinutes: task.duration_minutes === null ? "" : String(task.duration_minutes),
      blockCount: task.block_count === null ? "" : String(task.block_count),
      isRepeating: task.rule_id !== null,
      byweekday: [],
      savedWeekdays: task.rule_id === null ? [] : null,
    });
    setAreas([]);
    setGoals([]);
    setOptionsError(null);
    setFormError(null);
    setIsConfirmingDelete(false);
    void loadSchedule(task, formRequest.current);
  };

  const closeDraft = () => {
    formRequest.current += 1;
    setDraft(null);
    setAreas(null);
    setGoals([]);
    setOptionsError(null);
    setFormError(null);
    setIsConfirmingDelete(false);
  };

  const closeForm = () => {
    if (!isSaving) {
      closeDraft();
    }
  };

  const setRepeating = (isRepeating: boolean) =>
    updateDraft((current) => ({
      ...current,
      isRepeating,
      byweekday: !isRepeating
        ? []
        : current.task?.rule_id
          ? (current.savedWeekdays ?? [])
          : current.scheduledDate
            ? [weekdayForDate(current.scheduledDate)]
            : [],
    }));

  const toggleWeekday = (weekday: number) =>
    updateDraft((current) => {
      // A new schedule keeps the task's own day, so the rule supplies that occurrence.
      const isNewSchedule = current.isRepeating && !current.task?.rule_id;
      if (
        isNewSchedule &&
        current.scheduledDate !== "" &&
        weekday === weekdayForDate(current.scheduledDate)
      ) {
        return current;
      }
      return {
        ...current,
        byweekday: current.byweekday.includes(weekday)
          ? current.byweekday.filter((value) => value !== weekday)
          : [...current.byweekday, weekday].sort((a, b) => a - b),
      };
    });

  const saveTask = async () => {
    if (!draft || isSaving || !isTaskDraftComplete(draft)) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    let taskWasSaved = false;

    try {
      if (draft.task) {
        const changes = taskChanges(draft);
        if (changes) {
          const { data, error } = await updateTask(draft.task.id, changes);
          if (!data) {
            setFormError(taskErrorMessage(error, "We couldn't save this task."));
            return;
          }
          taskWasSaved = true;
          updateDraft((current) =>
            current.task
              ? {
                  ...current,
                  task: {
                    id: data.id,
                    goal_id: data.goal_id,
                    rule_id: data.rule_id,
                    title: data.title,
                    scheduled_date: data.scheduled_date,
                    start_time: data.start_time,
                    duration_minutes: data.duration_minutes,
                    block_count: data.block_count,
                  },
                  title: data.title,
                  scheduledDate: data.scheduled_date,
                  startTime: data.start_time ?? "",
                  durationMinutes:
                    data.duration_minutes === null ? "" : String(data.duration_minutes),
                  blockCount: data.block_count === null ? "" : String(data.block_count),
                }
              : current,
          );
        }

        const scheduleError = await saveSchedule(draft, draft.task);
        if (scheduleError) {
          if (taskWasSaved) {
            onSaved();
          }
          setFormError(scheduleError);
          return;
        }
      } else if (draft.isRepeating) {
        const { data, error } = await createGoalRule(draft.goalId, {
          byweekday: draft.byweekday,
          ...scheduleValues(draft),
        });
        if (!data) {
          setFormError(taskErrorMessage(error, "We couldn't add this schedule."));
          return;
        }
      } else {
        const fields = {
          scheduled_date: draft.scheduledDate,
          ...scheduleValues(draft),
        };
        const { data, error } = draft.goalId
          ? await createTask({ ...fields, goal_id: draft.goalId })
          : await createTask({ ...fields, goal_id: null, title: draft.title.trim() });
        if (!data) {
          setFormError(taskErrorMessage(error, "We couldn't add this task."));
          return;
        }
      }

      closeDraft();
      onSaved();
    } catch {
      if (taskWasSaved) {
        onSaved();
      }
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTask = async () => {
    const taskId = draft?.task?.id;
    if (!taskId || isSaving) {
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const { error, response } = await deleteTask(taskId);
      if (response.status !== 204) {
        setFormError(taskErrorMessage(error, "We couldn't delete this task."));
        return;
      }
      closeDraft();
      onDeleted();
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    draft,
    areas,
    goals,
    optionsError,
    formError,
    isSaving,
    isConfirmingDelete,
    openCreate,
    openEdit,
    closeForm,
    setGoalId: (goalId: string) =>
      updateDraft((current) => ({
        ...current,
        goalId,
        isRepeating: goalId === "" ? false : current.isRepeating,
        byweekday: goalId === "" ? [] : current.byweekday,
      })),
    setTitle: (title: string) => updateDraft((current) => ({ ...current, title })),
    setScheduledDate: (scheduledDate: string) =>
      updateDraft((current) => {
        if (current.task?.rule_id || !current.isRepeating) {
          return { ...current, scheduledDate };
        }
        const previousWeekday = current.scheduledDate
          ? weekdayForDate(current.scheduledDate)
          : null;
        if (scheduledDate === "") {
          return {
            ...current,
            scheduledDate,
            byweekday: current.byweekday.filter(
              (weekday) => previousWeekday === null || weekday !== previousWeekday,
            ),
          };
        }
        const nextWeekday = weekdayForDate(scheduledDate);
        return {
          ...current,
          scheduledDate,
          byweekday: [
            ...current.byweekday.filter(
              (weekday) => previousWeekday === null || weekday !== previousWeekday,
            ),
            nextWeekday,
          ]
            .filter((weekday, index, values) => values.indexOf(weekday) === index)
            .sort((a, b) => a - b),
        };
      }),
    setStartTime: (startTime: string) =>
      updateDraft((current) => ({ ...current, startTime })),
    setDurationMinutes: (durationMinutes: string) =>
      updateDraft((current) => ({ ...current, durationMinutes })),
    setBlockCount: (blockCount: string) =>
      updateDraft((current) => ({ ...current, blockCount })),
    setRepeating,
    toggleWeekday,
    saveTask,
    startDeleting: () => {
      setFormError(null);
      setIsConfirmingDelete(true);
    },
    cancelDeleting: () => setIsConfirmingDelete(false),
    deleteTask: removeTask,
  };
}

export function isTaskDraftComplete(draft: TaskDraft) {
  if (draft.scheduledDate === "") {
    return false;
  }
  const hasWork = draft.goalId === "" ? draft.title.trim().length > 0 : true;
  const canCreateRepeat =
    !draft.isRepeating ||
    Boolean(draft.task?.rule_id) ||
    (draft.goalId !== "" && draft.byweekday.includes(weekdayForDate(draft.scheduledDate)));
  return hasWork && canCreateRepeat;
}

export function isScheduleChanged(draft: TaskDraft) {
  return (
    draft.isRepeating &&
    draft.savedWeekdays !== null &&
    draft.byweekday.length > 0 &&
    draft.byweekday.join() !== draft.savedWeekdays.join()
  );
}

// Repeat on gives an ad-hoc goal task a schedule; Repeat off ends the task's schedule.
export function repeatChange(draft: TaskDraft): "start" | "stop" | null {
  const task = draft.task;
  if (!task || task.goal_id === null) {
    return null;
  }
  if (task.rule_id === null) {
    return draft.isRepeating ? "start" : null;
  }
  return draft.isRepeating ? null : "stop";
}

// Saves the schedule side of an edit after the task itself, returning a message when it fails.
async function saveSchedule(draft: TaskDraft, task: EditableTask) {
  const change = repeatChange(draft);
  if (change === "start") {
    const { data, error } = await repeatTask(task.id, draft.byweekday);
    return data ? null : taskErrorMessage(error, "We couldn't add this schedule.");
  }
  if (change === "stop") {
    const { data, error } = await stopRepeatingTask(task.id);
    return data ? null : taskErrorMessage(error, "We couldn't stop this schedule.");
  }
  if (task.rule_id && isScheduleChanged(draft)) {
    const { data, error } = await updateGoalRule(task.rule_id, { byweekday: draft.byweekday });
    return data ? null : taskErrorMessage(error, "We couldn't save this schedule.");
  }
  return null;
}

export function isTaskChanged(draft: TaskDraft) {
  return taskChanges(draft) !== null;
}

function scheduleValues(draft: TaskDraft) {
  return {
    start_time: draft.startTime || null,
    duration_minutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
    block_count: draft.blockCount ? Number(draft.blockCount) : null,
  };
}

function taskChanges(draft: TaskDraft) {
  const task = draft.task;
  if (!task) {
    return null;
  }
  const changes: UpdateTaskFields = {};
  const values = scheduleValues(draft);
  if (task.goal_id === null && draft.title.trim() !== task.title) {
    changes.title = draft.title.trim();
  }
  if (draft.scheduledDate !== task.scheduled_date) {
    changes.scheduled_date = draft.scheduledDate;
  }
  if (values.start_time !== task.start_time) {
    changes.start_time = values.start_time;
  }
  if (values.duration_minutes !== task.duration_minutes) {
    changes.duration_minutes = values.duration_minutes;
  }
  if (values.block_count !== task.block_count) {
    changes.block_count = values.block_count;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

function weekdayForDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCDay() || 7;
}

function taskErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }
  const value = error as {
    code?: unknown;
    message?: unknown;
    fields?: Record<string, unknown>;
  };
  if (value.code === "not_found") {
    return "This task, area or goal no longer exists. Reload to see the latest list.";
  }
  if (value.code === "validation_error" && typeof value.fields?.title === "string") {
    return value.fields.title;
  }
  if (
    value.code === "validation_error" &&
    typeof value.fields?.scheduled_date === "string"
  ) {
    return value.fields.scheduled_date;
  }
  return typeof value.message === "string" ? value.message : fallback;
}
