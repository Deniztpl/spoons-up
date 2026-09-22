import { type FormEvent, useState } from "react";

import { useAuth } from "../hooks/useAuth";

export type AuthMode = "login" | "register";

const inputClassName =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-sage-500 focus:ring-3 focus:ring-sage-100 disabled:cursor-not-allowed disabled:bg-stone-100";

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
  );
}
