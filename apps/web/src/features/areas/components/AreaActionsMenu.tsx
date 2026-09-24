import { useEffect, useId, useRef, useState } from "react";

type AreaActionsMenuProps = {
  isSaving: boolean;
  onRename: () => void;
  onArchive: () => void;
};

const plannedActions = [
  { label: "Add goal", markerClassName: "rounded-[3px]" },
  { label: "Add habit", markerClassName: "rounded-full" },
];

const itemClassName =
  "flex w-full items-center gap-[9px] rounded-[7px] px-2.5 py-2 text-left text-[13px] transition focus-visible:outline-2 focus-visible:outline-accent enabled:hover:bg-well disabled:cursor-not-allowed";

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none">
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.4v2.4M12 18.2v2.4M3.4 12h2.4M18.2 12h2.4M5.9 5.9l1.7 1.7M16.4 16.4l1.7 1.7M5.9 18.1l1.7-1.7M16.4 7.6l1.7-1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none">
      <path
        d="M4.5 19.5h4l10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16.5l-1 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="m14.2 7.8 3 3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none">
      <path
        d="M4 5.5h16v3.5H4zM5.5 9v9.5h13V9M10 13h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function AreaActionsMenu({
  isSaving,
  onRename,
  onArchive,
}: AreaActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Area actions"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={`grid size-8 place-items-center rounded-[9px] border text-accent transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isOpen ? "border-accent/35 bg-accent/12" : "border-ink/14 bg-card"
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <SettingsIcon />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          className="absolute right-0 top-[38px] z-20 flex w-[196px] flex-col rounded-[11px] border border-ink/12 bg-card p-1.5 shadow-[0_10px_26px_rgb(28_43_33/0.14)]"
        >
          {plannedActions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled
              className={`${itemClassName} text-muted`}
            >
              <span
                aria-hidden="true"
                className={`size-[9px] shrink-0 bg-current ${action.markerClassName}`}
              />
              {action.label}
              <span className="ml-auto text-[9px] uppercase tracking-[0.07em]">Soon</span>
            </button>
          ))}

          <div aria-hidden="true" className="mx-1.5 my-[5px] h-px bg-ink/9" />

          <button
            type="button"
            disabled={isSaving}
            className={`${itemClassName} text-ink disabled:opacity-60`}
            onClick={() => {
              setIsOpen(false);
              onRename();
            }}
          >
            <span className="grid w-3.5 place-items-center text-ink-soft">
              <RenameIcon />
            </span>
            Rename
          </button>
          <button
            type="button"
            disabled={isSaving}
            className={`${itemClassName} text-ink disabled:cursor-wait disabled:opacity-60`}
            onClick={onArchive}
          >
            <span className="grid w-3.5 place-items-center text-ink-soft">
              <ArchiveIcon />
            </span>
            {isSaving ? "Archiving..." : "Archive"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
