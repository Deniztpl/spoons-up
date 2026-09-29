import { useEffect, useId, useRef, useState } from "react";

import { CheckIcon } from "../../../components/ui/CheckIcon";
import type { Area } from "../../areas/api/areasApi";
import type { AreaResult, GrowthWeek } from "../api/resultsApi";
import { useGrowth } from "../hooks/useGrowth";
import { weekAmount } from "../weekAmount";

const weekFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dayInitialFormat = new Intl.DateTimeFormat("en", { weekday: "narrow" });

export function GrowthView({ areas }: { areas: Area[] }) {
  const { weeks, hasMore, isLoadingMore, loadError, loadMore } = useGrowth();
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  // The newest week starts open; opening another closes it.
  const [openWeek, setOpenWeek] = useState<string | null | undefined>(undefined);
  const shownAreaId = areas.some((area) => area.id === areaFilter) ? areaFilter : null;
  const openWeekStart = openWeek === undefined ? (weeks?.[0]?.period_start ?? null) : openWeek;
  const hasResults = weeks?.some((week) => week.areas.length > 0) ?? false;
  const filters = [{ id: null, name: "All areas" }, ...areas];

  return (
    <section aria-label="Growth">
      <div role="group" aria-label="Areas shown" className="mb-[18px] flex flex-wrap gap-1.5">
        {filters.map((option) => {
          const isShown = option.id === shownAreaId;
          return (
            <button
              key={option.id ?? "all"}
              type="button"
              aria-pressed={isShown}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isShown
                  ? "border-accent/30 bg-accent/12 text-ink"
                  : "border-ink/10 text-ink-soft hover:text-ink"
              }`}
              onClick={() => setAreaFilter(option.id)}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      {loadError && weeks === null ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}

      {weeks === null && !loadError ? (
        <p role="status" className="text-ink-soft">
          Loading your weeks…
        </p>
      ) : null}

      {weeks !== null && !hasResults && !hasMore ? (
        <div className="rounded-lg border border-dashed border-ink/16 px-7 py-9 text-center">
          <h2 className="text-[13.5px] font-medium">Your growth starts here</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-soft">
            Every week you finish shows up here once it closes.
          </p>
        </div>
      ) : null}

      {weeks !== null && (hasResults || hasMore) ? (
        <div className="flex flex-col gap-2">
          {weeks.map((week) => (
            <GrowthWeekCard
              key={week.period_start}
              week={week}
              shownAreaId={shownAreaId}
              isOpen={week.period_start === openWeekStart}
              onToggle={() =>
                setOpenWeek(week.period_start === openWeekStart ? null : week.period_start)
              }
            />
          ))}
        </div>
      ) : null}

      {weeks !== null && (loadError || hasMore) ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          {loadError ? (
            <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {loadError}
            </p>
          ) : null}
          {hasMore ? (
            <button
              type="button"
              disabled={isLoadingMore}
              className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:border-ink/25 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
              onClick={() => void loadMore()}
            >
              {isLoadingMore ? "Loading older weeks…" : "Show older weeks"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function GrowthWeekCard({
  week,
  shownAreaId,
  isOpen,
  onToggle,
}: {
  week: GrowthWeek;
  shownAreaId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyId = useId();
  const summaryId = useId();
  const areas = shownAreaId
    ? week.areas.filter((area) => area.area_id === shownAreaId)
    : week.areas;
  const percent = shownAreaId ? (areas[0]?.percent ?? null) : week.percent;
  const label = weekFormat.formatRange(localDate(week.period_start), localDate(week.period_end));
  const areaCount = `${areas.length} ${areas.length === 1 ? "area" : "areas"}`;

  return (
    <div className={`rounded-lg border ${isOpen ? "border-accent/24 bg-card" : "border-ink/8"}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={summaryId}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="flex w-full items-center gap-[18px] rounded-lg px-[18px] py-[17px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{label}</span>
        <span id={summaryId} className="sr-only">
          {areaCount}, {percent === null ? "nothing measured" : `${percent}% done`}
        </span>
        <span aria-hidden="true" className="whitespace-nowrap text-xs text-ink-soft">
          {areaCount}
        </span>
        <span aria-hidden="true" className="flex min-w-[66px] flex-[0_1_112px] items-center gap-2.5">
          <span className="h-1 flex-1 overflow-hidden rounded-[3px] bg-track">
            <span className="block h-full bg-accent" style={{ width: `${percent ?? 0}%` }} />
          </span>
          <span className="w-[34px] text-right text-[12.5px] text-ink-soft tabular-nums">
            {percent === null ? "–" : `${percent}%`}
          </span>
        </span>
        <span aria-hidden="true" className="w-3 text-xs text-muted">
          {isOpen ? "▴" : "▾"}
        </span>
      </button>

      {isOpen ? (
        <div id={bodyId} className="px-4 pb-3.5">
          {areas.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-soft">Nothing was measured this week.</p>
          ) : (
            <GrowthAreaTable areas={areas} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function GrowthAreaTable({ areas }: { areas: AreaResult[] }) {
  const days = areas[0]?.days ?? [];
  // One area's goals and habits are shown at a time.
  const [openAreaId, setOpenAreaId] = useState<string | null>(null);

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-[112px] sm:w-[146px]" />
        <col className="w-[86px] sm:w-[122px]" />
        <col className="w-[40px] sm:w-[62px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.08em] text-muted">
          <th scope="col" className="pb-2 pr-2.5 font-semibold sm:pr-3.5">
            Area
          </th>
          <th scope="col" className="pb-2 pr-2.5 font-semibold sm:pr-3.5">
            <span className="sr-only">Days</span>
            <span aria-hidden="true" className="flex gap-[3px] sm:gap-[5px]">
              {days.map((day) => (
                <span key={day.date} className="w-3 text-center sm:w-3.5">
                  {dayInitialFormat.format(localDate(day.date))}
                </span>
              ))}
            </span>
          </th>
          <th scope="col" className="pb-2 pr-2.5 font-semibold sm:pr-3.5">
            Done
          </th>
          <th scope="col" className="pb-2 text-right font-semibold">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {areas.map((area) => (
          <GrowthAreaRow
            key={area.area_id}
            area={area}
            isOpen={area.area_id === openAreaId}
            onToggle={() =>
              setOpenAreaId((current) => (current === area.area_id ? null : area.area_id))
            }
            onClose={() => setOpenAreaId(null)}
          />
        ))}
      </tbody>
    </table>
  );
}

function GrowthAreaRow({
  area,
  isOpen,
  onToggle,
  onClose,
}: {
  area: AreaResult;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // The row toggles the card itself, so only presses elsewhere close it here.
      if (!rowRef.current?.contains(target) && !cardRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* The whole row toggles; its button carries the keyboard and screen reader access. */}
      <tr ref={rowRef} className="cursor-pointer border-b border-line" onClick={onToggle}>
        <th scope="row" className="py-[9px] pr-2.5 text-left text-[13.5px] font-normal sm:pr-3.5">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={isOpen}
            aria-controls={cardId}
            className="flex max-w-full items-center gap-1.5 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="truncate">{area.name}</span>
            <span aria-hidden="true" className="shrink-0 text-xs text-muted">
              {isOpen ? "▴" : "▾"}
            </span>
          </button>
        </th>
        <td className="py-[9px] pr-2.5 sm:pr-3.5">
          <span aria-hidden="true" className="flex gap-[3px] sm:gap-[5px]">
            {area.days.map((day) => (
              <span
                key={day.date}
                className={`size-3 rounded sm:size-3.5 ${day.done ? "bg-accent" : "bg-track"}`}
              />
            ))}
          </span>
          <span className="sr-only">
            {area.days.filter((day) => day.done).length} of {area.days.length} days with every
            daily habit done
          </span>
        </td>
        <td className="py-[9px] pr-2.5 sm:pr-3.5">
          <span className="flex items-center gap-[5px] text-xs text-ink-soft tabular-nums sm:gap-[7px]">
            <span aria-hidden="true" className="size-[9px] shrink-0 rounded-[3px] bg-accent" />
            <span className="sr-only">Goals </span>
            {metFraction(area, "GOAL")}
            <span aria-hidden="true" className="ml-1 size-[9px] shrink-0 rounded-full bg-habit" />
            <span className="sr-only">Habits </span>
            {metFraction(area, "HABIT")}
          </span>
        </td>
        <td className="py-[9px] text-right text-[13px] text-ink-soft tabular-nums">
          {area.percent}%
        </td>
      </tr>
      {isOpen ? (
        // An empty row anchors the card under its area without pushing the rows below.
        <tr>
          <td colSpan={4} className="relative p-0">
            <div
              ref={cardRef}
              id={cardId}
              className="absolute left-3 top-1 z-20 w-[340px] max-w-[calc(100vw-4rem)] rounded-[11px] border border-ink/12 bg-card p-1.5 shadow-[0_10px_26px_rgb(28_43_33/0.14)]"
            >
              <ul aria-label={`${area.name} goals and habits`} className="flex flex-col">
                {area.requirements.map((item) => {
                  const isGoal = item.ref_type === "GOAL";
                  const isMet = item.done >= item.target;
                  return (
                    <li
                      key={`${item.ref_type}-${item.ref_id}`}
                      className="flex items-center gap-2.5 px-2 py-[7px]"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-4 shrink-0 place-items-center border-[1.5px] ${
                          isGoal ? "rounded-[5px]" : "rounded-full"
                        } ${
                          isMet
                            ? isGoal
                              ? "border-accent bg-accent text-white"
                              : "border-habit bg-habit text-white"
                            : "border-muted"
                        }`}
                      >
                        {isMet ? <CheckIcon /> : null}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${isMet ? "text-ink-soft" : ""}`}
                      >
                        {item.title}
                      </span>
                      <span className="sr-only">
                        , {isGoal ? "goal" : "habit"}, {item.done} of {item.target}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`shrink-0 rounded-[5px] px-[7px] py-[3px] text-[11px] font-semibold tabular-nums ${
                          isGoal ? "bg-accent/12 text-accent" : "bg-habit/12 text-habit-strong"
                        }`}
                      >
                        {weekAmount(item)}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs text-ink-soft tabular-nums">
                        {Math.round(Math.min(item.done / item.target, 1) * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function metFraction(area: AreaResult, refType: "GOAL" | "HABIT") {
  const items = area.requirements.filter((item) => item.ref_type === refType);
  if (items.length === 0) {
    return "–";
  }
  return `${items.filter((item) => item.done >= item.target).length}/${items.length}`;
}

function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
