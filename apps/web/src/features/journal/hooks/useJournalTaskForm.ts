import { useRef, useState } from "react";

import { createTask, updateTask } from "../../tasks/api/tasksApi";
import type { NewTaskDefaults } from "../../tasks/hooks/useTaskForm";
import { getJournal, type JournalItem, type JournalStep } from "../api/journalApi";
import { journalErrorMessage } from "./useJournal";

// What goes on the day: a new task, an open item without steps, or one open step.
export type JournalChoice =
  | { kind: "new"; title: string }
  | { kind: "item"; item: JournalItem }
  | { kind: "step"; item: JournalItem; step: JournalStep };

export type JournalTaskDraft = {
  scheduledDate: string;
  startTime: string;
  durationMinutes: string;
  blockCount: string;
  choice: JournalChoice | null;
};

export function useJournalTaskForm({ onSaved }: { onSaved: () => void }) {
  const [draft, setDraft] = useState<JournalTaskDraft | null>(null);
  const [items, setItems] = useState<JournalItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRequest = useRef(0);

  const updateDraft = (update: (current: JournalTaskDraft) => JournalTaskDraft) =>
    setDraft((current) => (current ? update(current) : current));

  // The choices are read from the Journal each time the form opens.
  const loadItems = async (request: number) => {
    try {
      const { data, error } = await getJournal();
      if (request !== formRequest.current) {
        return;
      }
      if (!data) {
        setLoadError(journalErrorMessage(error, "We couldn't load your journal."));
        return;
      }
      setItems(data.active);
    } catch {
      if (request === formRequest.current) {
        setLoadError("We couldn't reach Spoons Up. Please try again.");
      }
    }
  };

  const open = ({ scheduledDate, startTime = "" }: NewTaskDefaults) => {
    formRequest.current += 1;
    setDraft({ scheduledDate, startTime, durationMinutes: "", blockCount: "", choice: null });
    setItems(null);
    setLoadError(null);
    setFormError(null);
    void loadItems(formRequest.current);
  };

  const closeDraft = () => {
    formRequest.current += 1;
    setDraft(null);
    setItems(null);
    setLoadError(null);
    setFormError(null);
  };

  // A chosen task brings its own plan values into the fields that are still empty.
  const choose = (choice: JournalChoice | null) =>
    updateDraft((current) => {
      const task =
        choice?.kind === "step" ? choice.step : choice?.kind === "item" ? choice.item : null;
      return {
        ...current,
        choice,
        startTime: current.startTime || (task?.start_time ?? ""),
        durationMinutes:
          current.durationMinutes ||
          (task?.duration_minutes == null ? "" : String(task.duration_minutes)),
        blockCount:
          current.blockCount || (task?.block_count == null ? "" : String(task.block_count)),
      };
    });

  const save = async () => {
    if (!draft?.choice || isSaving || !isJournalTaskDraftComplete(draft)) {
      return;
    }
    const choice = draft.choice;
    const plan = {
      scheduled_date: draft.scheduledDate,
      start_time: draft.startTime || null,
      duration_minutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
      block_count: draft.blockCount ? Number(draft.blockCount) : null,
    };
    setIsSaving(true);
    setFormError(null);
    try {
      // A chosen item or step is planned where it is; only a new title creates a task.
      const { data, error } =
        choice.kind === "new"
          ? await createTask({ title: choice.title.trim(), ...plan })
          : await updateTask(choice.kind === "step" ? choice.step.id : choice.item.id, plan);
      if (!data) {
        setFormError(journalErrorMessage(error, "We couldn't plan this task."));
        return;
      }
      closeDraft();
      onSaved();
    } catch {
      setFormError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    draft,
    items,
    loadError,
    formError,
    isSaving,
    open,
    close: () => {
      if (!isSaving) {
        closeDraft();
      }
    },
    choose,
    setNewTitle: (title: string) =>
      updateDraft((current) =>
        current.choice?.kind === "new" ? { ...current, choice: { kind: "new", title } } : current,
      ),
    setScheduledDate: (scheduledDate: string) =>
      updateDraft((current) => ({ ...current, scheduledDate })),
    setStartTime: (startTime: string) => updateDraft((current) => ({ ...current, startTime })),
    setDurationMinutes: (durationMinutes: string) =>
      updateDraft((current) => ({ ...current, durationMinutes })),
    setBlockCount: (blockCount: string) => updateDraft((current) => ({ ...current, blockCount })),
    save,
  };
}

export function isJournalTaskDraftComplete({ scheduledDate, choice }: JournalTaskDraft) {
  if (scheduledDate === "" || choice === null) {
    return false;
  }
  return choice.kind !== "new" || choice.title.trim() !== "";
}
