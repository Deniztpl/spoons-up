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
    <div className="min-h-screen bg-ivory-100 text-stone-900">
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
          className="fixed right-4 top-20 z-40 max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          {logoutError}
        </div>
      ) : null}

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          aria-label="Page navigation"
          className="hidden w-[310px] shrink-0 border-r border-stone-200/80 bg-ivory-50 lg:block"
        >
          <AppSidebar />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {isNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]"
            onClick={closeNavigation}
          />
          <aside
            id="navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-drawer-title"
            className="relative h-full w-[min(88vw,340px)] border-r border-stone-200 bg-ivory-50 shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-stone-200/80 px-5">
              <h2 id="navigation-drawer-title" className="font-semibold tracking-[-0.02em]">
                Navigation
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation menu"
                className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:border-sage-300 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600"
                onClick={closeNavigation}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">
              <AppSidebar onNavigate={closeNavigation} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
