import type { RefObject } from "react";

type AppHeaderProps = {
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  isNavigationOpen: boolean;
  isLoggingOut: boolean;
  logoutErrorId?: string;
  onOpenNavigation: () => void;
  onLogout: () => void;
};

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function AppHeader({
  menuButtonRef,
  isNavigationOpen,
  isLoggingOut,
  logoutErrorId,
  onOpenNavigation,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="relative z-30 flex h-16 items-center border-b border-stone-200/80 bg-surface/95 px-4 backdrop-blur sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Open navigation menu"
        aria-controls="navigation-drawer"
        aria-expanded={isNavigationOpen}
        className="mr-3 grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 lg:hidden"
        onClick={onOpenNavigation}
      >
        <MenuIcon />
      </button>

      <div className="hidden items-center gap-3 sm:inline-flex">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-[13px] bg-sage-700 text-sm font-bold text-white shadow-sm"
        >
          S
        </span>
        <span className="text-lg font-semibold tracking-[-0.025em] text-stone-950">
          Spoons Up
        </span>
      </div>

      <label className="min-w-0 sm:ml-4 sm:border-l sm:border-stone-200 sm:pl-4">
        <span className="sr-only">Domain</span>
        <select
          aria-label="Domain"
          defaultValue="goals-and-habits"
          className="w-[148px] truncate rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 shadow-sm outline-none transition focus:border-sage-500 focus:ring-3 focus:ring-sage-100 sm:w-[190px]"
        >
          <option value="goals-and-habits">Goals &amp; Habits</option>
          <option value="nutrition" disabled>
            Nutrition — Coming soon
          </option>
          <option value="fitness" disabled>
            Fitness — Coming soon
          </option>
        </select>
      </label>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          disabled={isLoggingOut}
          aria-describedby={logoutErrorId}
          className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 disabled:cursor-wait disabled:opacity-60 sm:text-sm"
          onClick={onLogout}
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
