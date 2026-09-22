import type { Area } from "../api/areasApi";
import { AreaCreateForm } from "./AreaCreateForm";

type AreaListProps = {
  areas: Area[];
  selectedAreaId: string | null;
  isLoading: boolean;
  isAdding: boolean;
  isSaving: boolean;
  newAreaName: string;
  error: string | null;
  onSelect: (areaId: string) => void;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onNameChange: (name: string) => void;
  onCreate: () => void;
};

export function AreaList({
  areas,
  selectedAreaId,
  isLoading,
  isAdding,
  isSaving,
  newAreaName,
  error,
  onSelect,
  onStartAdding,
  onCancelAdding,
  onNameChange,
  onCreate,
}: AreaListProps) {
  return (
    <section
      aria-labelledby="area-list-title"
      className="rounded-[28px] border border-white/80 bg-surface p-6 shadow-panel sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="area-list-title" className="text-lg font-semibold text-stone-950">
            Your areas
          </h2>
          <p className="mt-1 text-sm text-stone-500">Choose an area to manage it.</p>
        </div>
        {!isAdding ? (
          <button
            type="button"
            className="shrink-0 rounded-xl bg-sage-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600"
            onClick={onStartAdding}
          >
            Add area
          </button>
        ) : null}
      </div>

      {isAdding ? (
        <AreaCreateForm
          name={newAreaName}
          error={error}
          isSaving={isSaving}
          onNameChange={onNameChange}
          onCancel={onCancelAdding}
          onSubmit={onCreate}
        />
      ) : null}

      <div className="mt-5 space-y-2">
        {isLoading ? (
          <p role="status" className="rounded-xl bg-ivory-100 px-4 py-3 text-sm text-stone-500">
            Loading areas…
          </p>
        ) : null}

        {!isLoading && areas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            No areas yet.
          </p>
        ) : null}

        {areas.map((area) => {
          const isSelected = area.id === selectedAreaId;
          return (
            <button
              key={area.id}
              type="button"
              aria-current={isSelected ? "page" : undefined}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 ${
                isSelected
                  ? "border-sage-300 bg-sage-50 font-semibold text-sage-800"
                  : "border-stone-200 bg-white text-stone-700 hover:border-sage-200 hover:bg-sage-50/40"
              }`}
              onClick={() => onSelect(area.id)}
            >
              {area.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
