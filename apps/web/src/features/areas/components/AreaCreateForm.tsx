import type { FormEvent } from "react";

type AreaCreateFormProps = {
  name: string;
  error: string | null;
  isSaving: boolean;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function AreaCreateForm({
  name,
  error,
  isSaving,
  onNameChange,
  onCancel,
  onSubmit,
}: AreaCreateFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="mt-5 rounded-2xl bg-ivory-100 p-4" onSubmit={handleSubmit}>
      <label htmlFor="new-area-name" className="text-sm font-semibold text-stone-700">
        Area name
      </label>
      <input
        id="new-area-name"
        autoFocus
        required
        maxLength={60}
        value={name}
        className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-100"
        onChange={(event) => onNameChange(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-sage-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "Creating…" : "Create area"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-500 hover:bg-white"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
