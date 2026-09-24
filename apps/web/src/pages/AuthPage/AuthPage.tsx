import { Link } from "react-router";

import {
  AuthForm,
  type AuthMode,
} from "../../features/auth/components/AuthForm";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-28 size-96 rounded-full bg-accent/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-28 size-[28rem] rounded-full bg-clay-100/80 blur-3xl"
      />

      <section
        aria-labelledby="auth-title"
        className="relative w-full max-w-md rounded-[28px] border border-white/90 bg-card p-7 shadow-panel sm:p-9"
      >
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-[14px] bg-accent text-sm font-bold text-white shadow-sm"
          >
            S
          </span>
          <span className="text-lg font-semibold tracking-[-0.025em] text-ink">
            Spoons Up
          </span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {isRegister ? "Begin gently" : "Welcome back"}
        </p>
        <h1
          id="auth-title"
          className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-ink"
        >
          {isRegister ? "Create your account" : "Sign in to your space"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          {isRegister
            ? "Start with a quiet place for the routines that matter to you."
            : "Pick up where you left off, one small step at a time."}
        </p>

        <AuthForm mode={mode} />

        <p className="mt-6 text-center text-sm text-ink-soft">
          {isRegister ? "Already have an account?" : "New to Spoons Up?"}{" "}
          <Link
            to={isRegister ? "/login" : "/register"}
            className="font-semibold text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-strong"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
