import { useId, useRef } from "react";

import { ModalDialog } from "../../../components/ui/ModalDialog";
import { OpenStepsConfirmation } from "./OpenStepsConfirmation";

// Asks before an item with open steps is completed outside its Journal detail.
export function OpenStepsDialog({
  title,
  openCount,
  onCancel,
  onConfirm,
}: {
  title: string;
  openCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog labelledBy={headingId} initialFocusRef={cancelRef} onClose={onCancel}>
      <h2 id={headingId} className="break-words text-lg font-semibold">
        {title}
      </h2>
      <OpenStepsConfirmation
        openCount={openCount}
        isSaving={false}
        cancelButtonRef={cancelRef}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </ModalDialog>
  );
}
