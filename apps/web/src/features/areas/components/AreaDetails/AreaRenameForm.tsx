import type { FormEvent } from "react";

type AreaRenameFormProps = {
  name: string;
  error: string | null;
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function AreaRenameForm({
  name,
  error,
  isSaving,
  onNameChange,
  onCancel,
  onSubmit,
}: AreaRenameFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="rename-area" className="text-xs font-medium text-ink-soft">
        Area name
      </label>
      <input
        id="rename-area"
        autoFocus
        required
        maxLength={60}
        value={name}
        className="mt-2 w-full rounded-lg border border-ink/20 bg-card px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15"
        onChange={(event) => onNameChange(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-[9px] px-4 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
