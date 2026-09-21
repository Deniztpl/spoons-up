import { type FormEvent, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "./useAuth";

type AuthMode = "login" | "register";

const inputClassName =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-sage-500 focus:ring-3 focus:ring-sage-100 disabled:cursor-not-allowed disabled:bg-stone-100";

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [timezone] = useState(() => getBrowserTimezone());
  const isRegister = mode === "register";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    const result = isRegister
      ? await register({ email: email.trim(), password, timezone })
      : await login({ email: email.trim(), password });

    if (!result.ok) {
      setErrorMessage(result.message);
      setFieldErrors(result.fields ?? {});
      setIsSubmitting(false);
    }
  };

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

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="text-sm font-semibold text-stone-800">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className={inputClassName}
              placeholder="you@example.com"
              onChange={(event) => setEmail(event.target.value)}
            />
            {fieldErrors.email ? (
              <p id="email-error" className="mt-1.5 text-xs text-red-700">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-semibold text-stone-800">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={isRegister ? 8 : 1}
              maxLength={128}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              className={inputClassName}
              placeholder={isRegister ? "At least 8 characters" : "Your password"}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password ? (
              <p id="password-error" className="mt-1.5 text-xs text-red-700">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          {isRegister ? (
            <p className="rounded-xl bg-ivory-100 px-3.5 py-3 text-xs leading-5 text-stone-500">
              Your timezone will be set to <strong className="text-stone-700">{timezone}</strong>.
            </p>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-sage-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sage-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600 disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting
              ? isRegister
                ? "Creating account…"
                : "Signing in…"
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

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
