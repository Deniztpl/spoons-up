import { Link } from "react-router";

import {
  AuthForm,
  type AuthMode,
} from "../../features/auth/components/AuthForm";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ivory-100 px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-28 size-96 rounded-full bg-sage-100/80 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-28 size-[28rem] rounded-full bg-clay-100/80 blur-3xl"
      />

      <section
        aria-labelledby="auth-title"
        className="relative w-full max-w-md rounded-[28px] border border-white/90 bg-surface p-7 shadow-panel sm:p-9"
      >
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-[14px] bg-sage-700 text-sm font-bold text-white shadow-sm"
          >
            S
          </span>
          <span className="text-lg font-semibold tracking-[-0.025em] text-stone-950">
            Spoons Up
          </span>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-700">
          {isRegister ? "Begin gently" : "Welcome back"}
        </p>
        <h1
          id="auth-title"
          className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-stone-950"
        >
          {isRegister ? "Create your account" : "Sign in to your space"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {isRegister
            ? "Start with a quiet place for the routines that matter to you."
            : "Pick up where you left off, one small step at a time."}
        </p>

        <AuthForm mode={mode} />

        <p className="mt-6 text-center text-sm text-stone-600">
          {isRegister ? "Already have an account?" : "New to Spoons Up?"}{" "}
          <Link
            to={isRegister ? "/login" : "/register"}
            className="font-semibold text-sage-700 underline decoration-sage-300 underline-offset-4 transition hover:text-sage-800"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
