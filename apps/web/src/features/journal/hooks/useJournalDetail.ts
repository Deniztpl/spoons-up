import { useRef, useState } from "react";

import {
  checkTask,
  createTask,
  deleteTask,
  uncheckTask,
  updateTask,
  type CreateTaskFields,
  type UpdateTaskFields,
} from "../../tasks/api/tasksApi";
import type { JournalItem, JournalStep } from "../api/journalApi";
import { journalErrorMessage } from "./useJournal";

export type JournalFields = {
  title: string;
  dueDate: string;
  startTime: string;
};

export type JournalDraft = {
  // Null until the item has been created.
  itemId: string | null;
  saved: JournalFields;
  fields: JournalFields;
};

// A step typed into the detail that the server does not have yet.
export type UnsavedStep = {
  key: number;
  title: string;
  state: "waiting" | "saving" | "failed";
};

export type JournalDetailAction = "create" | "save" | "complete" | "reopen" | "delete";

const emptyFields: JournalFields = { title: "", dueDate: "", startTime: "" };
const unreachableMessage = "We couldn't reach Spoons Up. Please try again.";

export function useJournalDetail({ onChange }: { onChange: () => Promise<void> }) {
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [unsavedSteps, setUnsavedSteps] = useState<UnsavedStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<JournalDetailAction | null>(null);
  const [pendingStepIds, setPendingStepIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<"complete" | "delete" | null>(null);
  // Each opened detail is a session; results that arrive after it closed are ignored.
  const session = useRef(0);
  // The step queue reads the latest steps between requests.
  const stepsRef = useRef<UnsavedStep[]>([]);
  const stepQueue = useRef(Promise.resolve());
  const nextStepKey = useRef(0);

  const stepsSaving =
    Boolean(draft?.itemId) && unsavedSteps.some((step) => step.state !== "failed");

  const updateSteps = (update: (steps: UnsavedStep[]) => UnsavedStep[]) => {
    stepsRef.current = update(stepsRef.current);
    setUnsavedSteps(stepsRef.current);
  };

  const reset = (nextDraft: JournalDraft | null) => {
    session.current += 1;
    setDraft(nextDraft);
    updateSteps(() => []);
    setError(null);
    setConfirming(null);
  };

  const report = (current: number, message: string) => {
    if (session.current === current) {
      setError(message);
    }
  };

  const updateFields = (changes: Partial<JournalFields>) =>
    setDraft((value) => (value ? { ...value, fields: { ...value.fields, ...changes } } : value));

  // Saves waiting steps one at a time, so they keep the order they were typed in.
  const saveWaitingSteps = (itemId: string) => {
    const current = session.current;
    const run = async () => {
      while (session.current === current) {
        const step = stepsRef.current.find((item) => item.state === "waiting");
        if (!step) {
          return;
        }
        updateSteps((steps) =>
          steps.map((item): UnsavedStep =>
            item.key === step.key ? { ...item, state: "saving" } : item,
          ),
        );
        let failure: string | null = null;
        try {
          const { data, error: stepError } = await createTask({
            parent_id: itemId,
            title: step.title,
          });
          if (!data) {
            failure = journalErrorMessage(stepError, `We couldn't add “${step.title}”.`);
          }
        } catch {
          failure = unreachableMessage;
        }
        if (failure !== null) {
          if (session.current === current) {
            // The steps after it wait for a retry, so the order stays as typed.
            updateSteps((steps) =>
              steps.map((item): UnsavedStep =>
                item.key === step.key || item.state === "waiting"
                  ? { ...item, state: "failed" }
                  : item,
              ),
            );
            setError(failure);
          }
          return;
        }
        await onChange();
        if (session.current === current) {
          updateSteps((steps) => steps.filter((item) => item.key !== step.key));
        }
      }
    };
    stepQueue.current = stepQueue.current.then(run);
    return stepQueue.current;
  };

  const createItem = async (fields: JournalFields, current: number) => {
    setBusyAction("create");
    setError(null);
    try {
      const { data, error: createError } = await createTask(newItemFields(fields));
      if (!data) {
        setError(journalErrorMessage(createError, "We couldn't add this item."));
        return;
      }
      // The item exists from here on; a step that fails later leaves it open on the saved item.
      const saved = journalFields(data);
      setDraft({ itemId: data.id, saved, fields: saved });
      const hadSteps = stepsRef.current.length > 0;
      if (hadSteps) {
        await saveWaitingSteps(data.id);
      }
      const hasUnsavedSteps = stepsRef.current.length > 0;
      if (!hadSteps || hasUnsavedSteps) {
        await onChange();
      }
      if (session.current === current && !hasUnsavedSteps) {
        reset(null);
      }
    } catch {
      setError(unreachableMessage);
    } finally {
      setBusyAction(null);
    }
  };

  const saveFields = async (itemId: string, edited: JournalDraft, current: number) => {
    const changes = fieldChanges(edited);
    if (!changes) {
      return;
    }
    setBusyAction("save");
    setError(null);
    try {
      const { data, error: saveError } = await updateTask(itemId, changes);
      if (!data) {
        setError(journalErrorMessage(saveError, "We couldn't save this item."));
        return;
      }
      if (session.current === current) {
        const saved = journalFields(data);
        setDraft((value) => (value ? { ...value, saved, fields: saved } : value));
      }
      await onChange();
    } catch {
      setError(unreachableMessage);
    } finally {
      setBusyAction(null);
    }
  };

  const save = async () => {
    if (!draft || busyAction !== null) {
      return;
    }
    if (draft.itemId === null) {
      await createItem(draft.fields, session.current);
    } else {
      await saveFields(draft.itemId, draft, session.current);
    }
  };

  const addStep = (title: string) => {
    const trimmed = title.trim();
    if (!draft || trimmed === "" || busyAction !== null) {
      return false;
    }
    const step: UnsavedStep = { key: nextStepKey.current++, title: trimmed, state: "waiting" };
    // A new item's steps are saved together with it.
    if (draft.itemId === null) {
      updateSteps((steps) => [...steps, step]);
      return true;
    }
    // A step typed after a failure retries the failed ones first.
    setError(null);
    updateSteps((steps) => [
      ...steps.map((item): UnsavedStep =>
        item.state === "failed" ? { ...item, state: "waiting" } : item,
      ),
      step,
    ]);
    void saveWaitingSteps(draft.itemId);
    return true;
  };

  const retrySteps = () => {
    if (!draft?.itemId) {
      return;
    }
    setError(null);
    updateSteps((steps) =>
      steps.map((step): UnsavedStep =>
        step.state === "failed" ? { ...step, state: "waiting" } : step,
      ),
    );
    void saveWaitingSteps(draft.itemId);
  };

  const toggleStep = async (step: JournalStep) => {
    if (pendingStepIds.includes(step.id)) {
      return;
    }
    const current = session.current;
    const done = step.status !== "DONE";
    setPendingStepIds((ids) => [...ids, step.id]);
    setError(null);
    try {
      const { data, error: stepError } = done
        ? await checkTask(step.id)
        : await uncheckTask(step.id);
      if (!data) {
        report(
          current,
          journalErrorMessage(
            stepError,
            done ? `We couldn't check off “${step.title}”.` : `We couldn't undo “${step.title}”.`,
          ),
        );
        return;
      }
      await onChange();
    } catch {
      report(current, unreachableMessage);
    } finally {
      setPendingStepIds((ids) => ids.filter((id) => id !== step.id));
    }
  };

  // Resolves true once the step is gone, so the caller can move focus.
  const deleteStep = async (step: JournalStep) => {
    if (pendingStepIds.includes(step.id)) {
      return false;
    }
    const current = session.current;
    setPendingStepIds((ids) => [...ids, step.id]);
    setError(null);
    try {
      const { error: stepError, response } = await deleteTask(step.id);
      if (response.status !== 204) {
        report(current, journalErrorMessage(stepError, `We couldn't delete “${step.title}”.`));
        return false;
      }
      await onChange();
      return true;
    } catch {
      report(current, unreachableMessage);
      return false;
    } finally {
      setPendingStepIds((ids) => ids.filter((id) => id !== step.id));
    }
  };

  const setDone = async (itemId: string, done: boolean) => {
    if (busyAction !== null) {
      return;
    }
    setBusyAction(done ? "complete" : "reopen");
    setError(null);
    try {
      const { data, error: doneError } = done
        ? await checkTask(itemId)
        : await uncheckTask(itemId);
      if (!data) {
        setError(
          journalErrorMessage(
            doneError,
            done ? "We couldn't complete this item." : "We couldn't reopen this item.",
          ),
        );
        return;
      }
      await onChange();
      setConfirming(null);
    } catch {
      setError(unreachableMessage);
    } finally {
      setBusyAction(null);
    }
  };

  // Completing an item with open steps asks first; the steps stay open under it.
  const requestCompletion = (item: JournalItem) => {
    if (item.progress.done < item.progress.total) {
      setError(null);
      setConfirming("complete");
      return;
    }
    void setDone(item.id, true);
  };

  const deleteItem = async () => {
    const itemId = draft?.itemId;
    if (!itemId || busyAction !== null) {
      return;
    }
    setBusyAction("delete");
    setError(null);
    try {
      const { error: deleteError, response } = await deleteTask(itemId);
      if (response.status !== 204) {
        setError(journalErrorMessage(deleteError, "We couldn't delete this item."));
        return;
      }
      await onChange();
      reset(null);
    } catch {
      setError(unreachableMessage);
    } finally {
      setBusyAction(null);
    }
  };

  return {
    draft,
    unsavedSteps,
    error,
    busyAction,
    pendingStepIds,
    confirming,
    openNew: () => reset({ itemId: null, saved: emptyFields, fields: emptyFields }),
    openItem: (item: JournalItem) => {
      const saved = journalFields(item);
      reset({ itemId: item.id, saved, fields: saved });
    },
    // Work in flight finishes before the detail can close.
    close: () => {
      if (busyAction === null && !stepsSaving) {
        reset(null);
      }
    },
    setTitle: (title: string) => updateFields({ title }),
    // Without a due date there is no time to keep.
    setDueDate: (dueDate: string) =>
      updateFields(dueDate ? { dueDate } : { dueDate: "", startTime: "" }),
    setStartTime: (startTime: string) => updateFields({ startTime }),
    discardChanges: () => {
      setError(null);
      setDraft((value) => (value ? { ...value, fields: value.saved } : value));
    },
    save,
    addStep,
    removeUnsavedStep: (key: number) =>
      updateSteps((steps) => steps.filter((step) => step.key !== key || step.state === "saving")),
    retrySteps,
    toggleStep,
    deleteStep,
    requestCompletion,
    confirmCompletion: () => {
      if (draft?.itemId) {
        void setDone(draft.itemId, true);
      }
    },
    reopen: (item: JournalItem) => void setDone(item.id, false),
    startDeleting: () => {
      setError(null);
      setConfirming("delete");
    },
    cancelConfirmation: () => setConfirming(null),
    deleteItem,
  };
}

export function isJournalDraftChanged(draft: JournalDraft) {
  return fieldChanges(draft) !== null;
}

// A new or moved due date follows the API's rule: today or later in the user's calendar.
export function isDueDateAllowed({ saved, fields }: JournalDraft, today: string) {
  return fields.dueDate === "" || fields.dueDate === saved.dueDate || fields.dueDate >= today;
}

// The time beside a due date is the task's own start time; without a due date there is none to edit.
function journalFields(task: {
  title: string;
  due_date: string | null;
  start_time: string | null;
}): JournalFields {
  return {
    title: task.title,
    dueDate: task.due_date ?? "",
    startTime: task.due_date ? (task.start_time ?? "") : "",
  };
}

function newItemFields({ title, dueDate, startTime }: JournalFields): CreateTaskFields {
  return dueDate
    ? { title: title.trim(), due_date: dueDate, start_time: startTime || null }
    : { title: title.trim() };
}

function fieldChanges({ saved, fields }: JournalDraft) {
  const changes: UpdateTaskFields = {};
  const title = fields.title.trim();
  if (title !== saved.title) {
    changes.title = title;
  }
  if (fields.dueDate !== saved.dueDate) {
    changes.due_date = fields.dueDate || null;
    // A new due date keeps the time shown beside it; clearing it clears the time on the server.
    if (fields.dueDate) {
      changes.start_time = fields.startTime || null;
    }
  } else if (fields.startTime !== saved.startTime) {
    changes.start_time = fields.startTime || null;
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
