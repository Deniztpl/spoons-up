import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { AreaIcon } from "../../features/areas/components/AreaIcon";

const pages: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/areas", label: "Areas", icon: <AreaIcon /> },
  { to: "/today", label: "Today", icon: <TodayIcon /> },
];

const plannedPages = ["Week"];

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
        {pages.map((page) => (
          <NavLink
            key={page.to}
            to={page.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "bg-accent/12 font-semibold text-ink"
                  : "text-ink-soft hover:bg-card/70 hover:text-ink"
              }`
            }
            onClick={onNavigate}
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid w-5 place-items-center ${isActive ? "text-accent" : "text-ink-soft"}`}
                >
                  {page.icon}
                </span>
                {page.label}
              </>
            )}
          </NavLink>
        ))}

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

function TodayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8.8 12.2 2.2 2.2 4.3-4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
