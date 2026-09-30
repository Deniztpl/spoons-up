import { useId, useRef } from "react";

import { ModalDialog } from "../../../components/ui/ModalDialog";
import type { JournalItem } from "../api/journalApi";
import { OpenStepsConfirmation } from "./OpenStepsConfirmation";

// Asks before an item with open steps is completed outside its detail.
export function OpenStepsDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: JournalItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={cancelRef} onClose={onCancel}>
      <h2 id={headingId} className="break-words text-lg font-semibold">
        {item.title}
      </h2>
      <OpenStepsConfirmation
        openCount={item.progress.total - item.progress.done}
        isSaving={false}
        cancelButtonRef={cancelRef}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </ModalDialog>
  );
}
