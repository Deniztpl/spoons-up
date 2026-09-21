import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "./AppShell";
import { AuthPage } from "./auth/AuthPage";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";

function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-ivory-100 px-6 text-center">
      <div role="status" className="flex flex-col items-center gap-4 text-stone-600">
        <span className="grid size-11 place-items-center rounded-2xl bg-sage-700 text-sm font-bold text-white shadow-sm">
          S
        </span>
        <span className="text-sm font-medium">Restoring your session…</span>
      </div>
    </main>
  );
}

function AppRoutes() {
  const { status, logout } = useAuth();

  if (status === "checking") {
    return <SessionLoading />;
  }

  if (status === "authenticated") {
    return (
      <Routes>
        <Route path="/" element={<AppShell onLogout={logout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
