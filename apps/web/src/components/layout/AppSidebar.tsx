import { NavLink } from "react-router";

import { AreaIcon } from "../../features/areas/components/AreaIcon";

const plannedPages = ["Today", "Week"];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-5">
      <p className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
        Goals &amp; Habits
      </p>

      <nav aria-label="Goals & Habits pages" className="mt-3 space-y-1.5">
        <NavLink
          to="/areas"
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 ${
              isActive
                ? "bg-sage-100 font-semibold text-sage-800"
                : "text-stone-600 hover:bg-white hover:text-stone-900"
            }`
          }
          onClick={onNavigate}
        >
          <span className="grid size-8 place-items-center rounded-xl bg-sage-50 text-sage-700">
            <AreaIcon />
          </span>
          Areas
        </NavLink>

        {plannedPages.map((page) => (
          <button
            key={page}
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-400"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-stone-100 text-xs font-bold">
              {page[0]}
            </span>
            {page}
            <span className="ml-auto rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
              Coming soon
            </span>
          </button>
        ))}
      </nav>

      <p className="mt-auto px-2 pt-8 text-[11px] leading-4 text-stone-400">
        Small steps, gathered gently.
      </p>
    </div>
  );
}
