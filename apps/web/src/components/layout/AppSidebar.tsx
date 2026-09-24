import { NavLink } from "react-router";

import { AreaIcon } from "../../features/areas/components/AreaIcon";

const plannedPages = ["Today", "Week"];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
      <div className="flex items-center gap-[9px] px-1.5 pb-5 pt-1">
        <span
          aria-hidden="true"
          className="grid size-[26px] place-items-center rounded-lg bg-accent text-xs font-semibold text-white"
        >
          S
        </span>
        <span className="text-[15px] font-semibold">Spoons Up</span>
      </div>

      <p className="px-1.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-soft">
        Goals &amp; Habits
      </p>

      <nav aria-label="Goals & Habits pages" className="flex flex-col gap-0.5">
        <NavLink
          to="/areas"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isActive
                ? "bg-accent/12 font-semibold text-ink"
                : "text-ink-soft hover:bg-card/70 hover:text-ink"
            }`
          }
          onClick={onNavigate}
        >
          <span className="grid w-5 place-items-center text-accent">
            <AreaIcon />
          </span>
          Areas
        </NavLink>

        {plannedPages.map((page) => (
          <button
            key={page}
            type="button"
            disabled
            className="flex cursor-not-allowed items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-left text-muted"
          >
            <span aria-hidden="true" className="grid w-5 place-items-center">
              <span className="size-1 rounded-full bg-current" />
            </span>
            {page}
            <span className="ml-auto text-[9px] uppercase tracking-[0.07em]">Soon</span>
          </button>
        ))}
      </nav>

      <p className="mt-auto px-1.5 pt-8 text-[11px] text-muted-light">
        Small steps, gathered gently.
      </p>
    </div>
  );
}
