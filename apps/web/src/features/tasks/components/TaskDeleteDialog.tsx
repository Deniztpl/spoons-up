import { useId, useRef } from "react";

import { ModalDialog } from "../../../components/ui/ModalDialog";
import { TaskDeleteConfirmation } from "./TaskDeleteConfirmation";

// Asks before a task is deleted from the calendar; Enter deletes and Escape cancels.
export function TaskDeleteDialog({
  title,
  isGoalLinked,
  stepCount,
  onCancel,
  onDelete,
}: {
  title: string;
  isGoalLinked: boolean;
  stepCount: number;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const headingId = useId();
  const deleteRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={deleteRef} onClose={onCancel}>
      <h2 id={headingId} className="sr-only">
        Delete task
      </h2>
      <TaskDeleteConfirmation
        taskTitle={title}
        isGoalLinked={isGoalLinked}
        stepCount={stepCount}
        isSaving={false}
        deleteButtonRef={deleteRef}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </ModalDialog>
  );
}
