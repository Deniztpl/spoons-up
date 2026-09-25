import { Navigate, Route, Routes } from "react-router";

import { useAuth } from "../features/auth/hooks/useAuth";
import { AreasPage } from "../pages/AreasPage/AreasPage";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { TodayPage } from "../pages/TodayPage/TodayPage";

export function AppRouter() {
  const { status, logout } = useAuth();

  if (status === "checking") {
    return <SessionLoading />;
  }

  if (status === "authenticated") {
    return (
      <Routes>
        <Route path="/today" element={<TodayPage onLogout={logout} />} />
        <Route path="/areas" element={<AreasPage onLogout={logout} />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return null;
}

function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <div role="status" className="flex flex-col items-center gap-4 text-ink-soft">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent text-sm font-bold text-white shadow-sm">
          S
        </span>
        <span className="text-sm font-medium">Restoring your session…</span>
      </div>
    </main>
  );
}
