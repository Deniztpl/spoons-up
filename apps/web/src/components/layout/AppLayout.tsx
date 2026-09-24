import { type ReactNode, useEffect, useRef, useState } from "react";

import type { AuthActionResult } from "../../features/auth/AuthContext";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

type AppLayoutProps = {
  children: ReactNode;
  onLogout: () => Promise<AuthActionResult>;
};

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

export function AppLayout({
  children,
  onLogout,
}: AppLayoutProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeNavigation = () => setIsNavigationOpen(false);

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
    if (!isNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavigationOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerButton?.focus();
    };
  }, [isNavigationOpen]);

  return (
    <div className="flex min-h-screen bg-canvas text-sm text-ink">
      <aside
        aria-label="Page navigation"
        className="sticky top-0 hidden h-screen w-[206px] shrink-0 border-r border-line bg-sidebar lg:block"
      >
        <AppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          menuButtonRef={menuButtonRef}
          isNavigationOpen={isNavigationOpen}
          isLoggingOut={isLoggingOut}
          logoutErrorId={logoutError ? "logout-error" : undefined}
          onOpenNavigation={() => setIsNavigationOpen(true)}
          onLogout={() => void handleLogout()}
        />

        {logoutError ? (
          <div
            id="logout-error"
            role="alert"
            className="fixed right-4 top-16 z-40 max-w-sm rounded-[11px] border border-danger/25 bg-danger-soft px-4 py-3 text-danger shadow-[0_10px_26px_rgb(28_43_33/0.14)]"
          >
            {logoutError}
          </div>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>

      {isNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            onClick={closeNavigation}
          />
          <aside
            id="navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-drawer-title"
            className="relative h-full w-[min(84vw,280px)] border-r border-line bg-sidebar shadow-2xl"
          >
            <h2 id="navigation-drawer-title" className="sr-only">
              Navigation
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-[9px] text-ink-soft transition hover:bg-card hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={closeNavigation}
            >
              <CloseIcon />
            </button>
            <AppSidebar onNavigate={closeNavigation} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
