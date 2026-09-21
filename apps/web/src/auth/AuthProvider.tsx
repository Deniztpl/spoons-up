import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { apiClient, authApiClient, refreshSession } from "../lib/api";
import {
  AuthContext,
  type AuthActionResult,
  type LoginRequest,
  type RegisterRequest,
} from "./AuthContext";
import {
  getAuthStatus,
  setAuthenticated,
  setUnauthenticated,
  subscribeToAuth,
} from "./session";

function failureResult(error: unknown, fallback: string): AuthActionResult {
  if (typeof error !== "object" || error === null) {
    return { ok: false, message: fallback };
  }

  const value = error as {
    message?: unknown;
    fields?: unknown;
  };
  const message = typeof value.message === "string" ? value.message : fallback;
  const fields =
    typeof value.fields === "object" && value.fields !== null
      ? (value.fields as Record<string, string>)
      : undefined;

  return { ok: false, message, fields };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(
    subscribeToAuth,
    getAuthStatus,
    getAuthStatus,
  );

  useEffect(() => {
    if (getAuthStatus() === "checking") {
      void refreshSession();
    }
  }, []);

  const login = useCallback(async (payload: LoginRequest): Promise<AuthActionResult> => {
    try {
      const { data, error } = await authApiClient.POST("/api/v1/auth/login", {
        body: payload,
      });
      if (data) {
        setAuthenticated(data.access_token);
        return { ok: true };
      }
      return failureResult(error, "We couldn't sign you in. Please try again.");
    } catch {
      return {
        ok: false,
        message: "We couldn't reach Spoons Up. Check your connection and try again.",
      };
    }
  }, []);

  const register = useCallback(
    async (payload: RegisterRequest): Promise<AuthActionResult> => {
      try {
        const { data, error } = await authApiClient.POST("/api/v1/auth/register", {
          body: payload,
        });
        if (data) {
          setAuthenticated(data.access_token);
          return { ok: true };
        }
        return failureResult(error, "We couldn't create your account. Please try again.");
      } catch {
        return {
          ok: false,
          message: "We couldn't reach Spoons Up. Check your connection and try again.",
        };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<AuthActionResult> => {
    try {
      const { error, response } = await apiClient.POST("/api/v1/auth/logout");
      if (response.status === 204) {
        setUnauthenticated();
        return { ok: true };
      }
      return failureResult(error, "We couldn't log you out. Please try again.");
    } catch {
      return {
        ok: false,
        message: "We couldn't reach Spoons Up. Please try logging out again.",
      };
    }
  }, []);

  const value = useMemo(
    () => ({ status, login, register, logout }),
    [status, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
