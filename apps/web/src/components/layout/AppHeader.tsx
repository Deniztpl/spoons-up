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
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6 lg:px-[34px]">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Open navigation menu"
        aria-controls="navigation-drawer"
        aria-expanded={isNavigationOpen}
        className="grid size-9 place-items-center rounded-[9px] border border-ink/14 bg-card text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
        onClick={onOpenNavigation}
      >
        <MenuIcon />
      </button>

      <span
        aria-hidden="true"
        className="hidden size-[26px] place-items-center rounded-lg bg-accent text-xs font-semibold text-white sm:grid lg:hidden"
      >
        S
      </span>

      <label className="min-w-0">
        <span className="sr-only">Domain</span>
        <select
          aria-label="Domain"
          defaultValue="goals-and-habits"
          className="w-[148px] truncate rounded-[9px] border border-ink/14 bg-card px-3 py-2 text-[13px] font-medium text-ink outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15 sm:w-[190px]"
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
          className="rounded-[9px] border border-ink/14 bg-card px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:border-ink/25 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
          onClick={onLogout}
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>
    </header>
  );
}
