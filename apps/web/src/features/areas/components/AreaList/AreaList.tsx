import type { AreaResult } from "../../../results/api/resultsApi";
import type { Area } from "../../api/areasApi";
import { areaColorClass } from "../../areaColor";
import { AreaCreateForm } from "./AreaCreateForm";

const emptyWeek = Array.from({ length: 7 }, () => ({ done: false }));

type AreaListProps = {
  areas: Area[];
  view: "active" | "archived";
  // This week's progress by area id; null while it loads.
  progress: Map<string, AreaResult> | null;
  selectedAreaId: string | null;
  isLoading: boolean;
  isAdding: boolean;
  isSaving: boolean;
  newAreaName: string;
  error: string | null;
  onSelect: (areaId: string) => void;
  onCancelAdding: () => void;
  onNameChange: (name: string) => void;
  onCreate: () => void;
};

export function AreaList({
  areas,
  view,
  progress,
  selectedAreaId,
  isLoading,
  isAdding,
  isSaving,
  newAreaName,
  error,
  onSelect,
  onCancelAdding,
  onNameChange,
  onCreate,
}: AreaListProps) {
  const isArchivedView = view === "archived";

  const renderArea = (area: Area) => {
    const isSelected = area.id === selectedAreaId;
    const tone = isSelected
      ? "border-accent/33 bg-accent/9"
      : isArchivedView
        ? "border-ink/16 bg-well hover:bg-card"
        : "border-ink/10 bg-card hover:bg-well";
    const showsProgress = progress !== null && !isArchivedView;
    const result = progress?.get(area.id);
    const progressId = `area-${area.id}-progress`;
    return (
      <button
        key={area.id}
        type="button"
        aria-label={`${area.name}${isArchivedView ? " (archived)" : ""}`}
        aria-describedby={showsProgress ? progressId : undefined}
        aria-current={isSelected ? "page" : undefined}
        className={`flex w-full items-center gap-[18px] rounded-lg border px-[18px] py-[17px] text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isArchivedView ? "border-dashed" : ""
        } ${tone} ${areaColorClass(area)}`}
        onClick={() => onSelect(area.id)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-area" />
          <span
            className={`truncate text-[15.5px] font-medium ${isArchivedView ? "text-ink-soft" : ""}`}
          >
            {area.name}
          </span>
        </span>
        {area.archived_at !== null ? (
          <span className="shrink-0 whitespace-nowrap text-xs text-ink-soft">
            Archived {archivedDateFormat.format(new Date(area.archived_at))}
          </span>
        ) : null}
        {showsProgress ? (
          <>
            <span id={progressId} className="sr-only">
              {result ? `${result.percent}% this week` : "Nothing to measure this week"}
            </span>
            <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
              {(result?.days ?? emptyWeek).map((day, index) => (
                <span
                  key={index}
                  className={`size-[9px] rounded-full ${day.done ? "bg-accent" : "bg-track"}`}
                />
              ))}
            </span>
            <span aria-hidden="true" className="flex min-w-[66px] flex-[0_1_112px] items-center gap-2.5">
              <span className="h-1 flex-1 overflow-hidden rounded-[3px] bg-track">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${result?.percent ?? 0}%` }}
                />
              </span>
              <span className="w-[34px] text-right text-[12.5px] text-ink-soft tabular-nums">
                {result ? `${result.percent}%` : "–"}
              </span>
            </span>
          </>
        ) : null}
      </button>
    );
  };

  return (
    <section aria-labelledby="area-list-title">
      <h2 id="area-list-title" className="sr-only">
        {isArchivedView ? "Archived areas" : "Your areas"}
      </h2>

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

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p role="status" className="rounded-lg bg-well px-[18px] py-[17px] text-ink-soft">
            Loading areas…
          </p>
        ) : null}

        {!isLoading && areas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/16 px-7 py-7 text-center text-[13px] text-ink-soft">
            {isArchivedView ? "No archived areas." : "No active areas."}
          </p>
        ) : null}

        {areas.map(renderArea)}
      </div>
    </section>
  );
}

const archivedDateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
