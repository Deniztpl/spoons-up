import { useEffect, useRef, useState } from "react";

import type { AuthActionResult } from "./auth/AuthContext";

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

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
      <path
        d="M18.8 4.4C13 4.8 8.4 7.2 6.6 11.1c-1.2 2.6-.4 5.1 1.7 6.2 2 1 4.4.2 5.7-1.9 2-3.2 1.9-7.2 4.8-11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M5 20c1.7-4.3 4.5-7.4 8.7-9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6 text-stone-900">
        <span className="grid size-8 place-items-center rounded-xl bg-sage-100 text-sage-700">
          <LeafIcon />
        </span>
        <h2 className="text-sm font-semibold tracking-wide">Areas</h2>
      </div>

      <div className="mx-4 rounded-2xl border border-dashed border-stone-300/90 bg-white/55 px-5 py-7 text-center">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-ivory-200 text-sage-600">
          <LeafIcon />
        </div>
        <p className="text-sm font-semibold text-stone-800">No areas yet</p>
        <p className="mt-1.5 text-xs leading-5 text-stone-500">
          Your areas will appear here when you create them.
        </p>
      </div>

      <p className="mt-auto px-5 pb-6 text-[11px] leading-4 text-stone-400">
        Small steps, gathered gently.
      </p>
    </div>
  );
}

function WelcomePanel() {
  return (
    <section
      aria-labelledby="welcome-title"
      className="relative isolate overflow-hidden rounded-[28px] border border-white/80 bg-surface p-7 shadow-panel sm:p-10 lg:p-12"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-20 -z-10 size-72 rounded-full bg-sage-100/70 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full bg-clay-100/70 blur-3xl"
      />

      <div className="max-w-2xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-sage-700">
          <span className="size-1.5 rounded-full bg-sage-500" />
          Your calm workspace
        </p>
        <h1
          id="welcome-title"
          className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-stone-950 sm:text-5xl"
        >
          Welcome to Spoons Up
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-stone-600">
          A gentle place to bring your habits, goals, and weekly rhythm together.
          Your day will take shape here.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="Workspace preview">
        {[
          ["01", "Choose an area", "Make space for what matters"],
          ["02", "Build your rhythm", "Shape habits around your week"],
          ["03", "Notice progress", "Reflect without the pressure"],
        ].map(([number, title, description]) => (
          <div
            key={number}
            className="rounded-2xl border border-stone-200/80 bg-white/70 p-4 backdrop-blur-sm"
          >
            <span className="text-[11px] font-bold tracking-[0.18em] text-sage-600">
              {number}
            </span>
            <h3 className="mt-5 text-sm font-semibold text-stone-900">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AppShell({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    const result = await onLogout();
    if (!result.ok) {
      setLogoutError(result.message);
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerButton?.focus();
    };
  }, [isDrawerOpen]);

  return (
    <div className="min-h-screen bg-ivory-100 text-stone-900">
      <header className="relative z-30 flex h-16 items-center border-b border-stone-200/80 bg-surface/95 px-4 backdrop-blur sm:px-6">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open areas menu"
          aria-controls="areas-drawer"
          aria-expanded={isDrawerOpen}
          className="mr-3 grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 lg:hidden"
          onClick={() => setIsDrawerOpen(true)}
        >
          <MenuIcon />
        </button>

        <div className="inline-flex items-center gap-3">
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

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-stone-500 md:flex">
            <span className="size-2 rounded-full bg-sage-500" />
            A softer way forward
          </div>
          <button
            type="button"
            disabled={isLoggingOut}
            aria-describedby={logoutError ? "logout-error" : undefined}
            className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 disabled:cursor-wait disabled:opacity-60 sm:text-sm"
            onClick={() => void handleLogout()}
          >
            {isLoggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      {logoutError ? (
        <div
          id="logout-error"
          role="alert"
          className="fixed right-4 top-20 z-40 max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          {logoutError}
        </div>
      ) : null}

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          aria-label="Areas"
          className="hidden w-[280px] shrink-0 border-r border-stone-200/80 bg-ivory-50 lg:block"
        >
          <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-6xl">
            <WelcomePanel />
          </div>
        </main>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close areas drawer backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside
            id="areas-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="areas-drawer-title"
            className="relative h-full w-[min(84vw,320px)] border-r border-stone-200 bg-ivory-50 shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-stone-200/80 px-5">
              <h2 id="areas-drawer-title" className="font-semibold tracking-[-0.02em]">
                Areas
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close areas menu"
                className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600"
                onClick={() => setIsDrawerOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">
              <SidebarContent />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
