import { type FormEvent, useState } from "react";

import { useAuth } from "../hooks/useAuth";

export type AuthMode = "login" | "register";

const inputClassName =
  "mt-2 w-full rounded-xl border border-ink/20 bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-well";

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function AuthForm({ mode }: { mode: AuthMode }) {
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
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-ink">
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
          <p id="email-error" className="mt-1.5 text-xs text-danger">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-semibold text-ink">
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
          <p id="password-error" className="mt-1.5 text-xs text-danger">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {isRegister ? (
        <p className="rounded-xl bg-well px-3.5 py-3 text-xs leading-5 text-ink-soft">
          Your timezone will be set to <strong className="text-ink">{timezone}</strong>.
        </p>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
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
  );
}
