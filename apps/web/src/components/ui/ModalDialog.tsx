import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from "react";

type ModalDialogProps = {
  labelledBy: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  onClose: () => void;
};

const focusableSelector =
  'button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked, select:not([disabled]), [href]';

export function ModalDialog({
  labelledBy,
  initialFocusRef,
  children,
  onClose,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Restore focus when the dialog closes.
  useEffect(() => {
    const opener = document.activeElement;
    initialFocusRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) {
        opener.focus();
      }
    };
  }, [initialFocusRef]);

  // Keep keyboard focus inside the dialog.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/28 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex max-h-[88vh] w-[440px] max-w-full flex-col gap-4 overflow-y-auto rounded-[14px] bg-card px-6 py-[22px] shadow-[0_24px_60px_rgb(28_43_33/0.25)]"
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
