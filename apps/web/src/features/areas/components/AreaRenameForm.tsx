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
    <form className="mt-3 max-w-lg" onSubmit={handleSubmit}>
      <label htmlFor="rename-area" className="text-sm font-semibold text-stone-700">
        Area name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="rename-area"
          autoFocus
          required
          maxLength={60}
          value={name}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-100"
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 hover:bg-stone-100"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
