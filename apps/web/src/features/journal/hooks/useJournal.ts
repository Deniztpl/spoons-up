import { useEffect, useRef, useState } from "react";

import { checkTask, uncheckTask } from "../../tasks/api/tasksApi";
import { getJournal, type Journal, type JournalItem } from "../api/journalApi";

export function useJournal() {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [confirmingItem, setConfirmingItem] = useState<JournalItem | null>(null);
  // Callers waiting for the next read to land.
  const reloadWaiters = useRef<(() => void)[]>([]);

  // Load the Journal, and again after each change; a newer read replaces an older one.
  useEffect(() => {
    let cancelled = false;

    async function loadJournal() {
      try {
        const { data, error } = await getJournal();
        if (cancelled) {
          return;
        }
        if (!data) {
          setLoadError(journalErrorMessage(error, "We couldn't load your journal."));
          return;
        }
        setJournal(data);
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't reach Spoons Up. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          const waiters = reloadWaiters.current;
          reloadWaiters.current = [];
          waiters.forEach((resolve) => resolve());
        }
      }
    }

    void loadJournal();
    return () => {
      cancelled = true;
    };
  }, [loadCount]);

  // Resolves once a read started after this call has landed.
  const reload = () =>
    new Promise<void>((resolve) => {
      reloadWaiters.current.push(() => resolve());
      setLoadCount((count) => count + 1);
    });

  const setItemDone = async (item: JournalItem, done: boolean) => {
    if (pendingItemIds.includes(item.id)) {
      return;
    }
    setPendingItemIds((current) => [...current, item.id]);
    setActionError(null);
    try {
      const { data, error } = done ? await checkTask(item.id) : await uncheckTask(item.id);
      if (!data) {
        setActionError(
          journalErrorMessage(
            error,
            done ? `We couldn't complete ${item.title}.` : `We couldn't reopen ${item.title}.`,
          ),
        );
        return;
      }
      // The item moves between the lists in the server's order.
      await reload();
    } catch {
      setActionError("We couldn't reach Spoons Up. Please try again.");
    } finally {
      setPendingItemIds((current) => current.filter((id) => id !== item.id));
    }
  };

  // An item with open steps asks before it is completed.
  const toggleItem = (item: JournalItem) => {
    const done = item.status !== "DONE";
    if (done && item.progress.done < item.progress.total) {
      setConfirmingItem(item);
      return;
    }
    void setItemDone(item, done);
  };

  const confirmCompletion = () => {
    if (!confirmingItem) {
      return;
    }
    setConfirmingItem(null);
    void setItemDone(confirmingItem, true);
  };

  return {
    journal,
    isLoading,
    loadError,
    actionError,
    pendingItemIds,
    confirmingItem,
    reload,
    toggleItem,
    confirmCompletion,
    cancelCompletion: () => setConfirmingItem(null),
  };
}

export function journalErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }
  const value = error as {
    code?: unknown;
    message?: unknown;
    fields?: Record<string, unknown>;
  };
  if (value.code === "not_found") {
    return "This item no longer exists. Reload the page to see the latest list.";
  }
  if (value.code === "validation_error") {
    const fieldMessage = Object.values(value.fields ?? {}).find(
      (message) => typeof message === "string",
    );
    if (typeof fieldMessage === "string") {
      return fieldMessage;
    }
  }
  return typeof value.message === "string" ? value.message : fallback;
}
