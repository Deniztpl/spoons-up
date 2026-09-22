import type { components } from "@spoons-up/api-client";
import { createContext } from "react";

import type { AuthStatus } from "./session";

export type LoginRequest = components["schemas"]["LoginRequest"];
export type RegisterRequest = components["schemas"]["RegisterRequest"];

export type AuthActionResult =
  | { ok: true }
  | { ok: false; message: string; fields?: Record<string, string> };

export type AuthContextValue = {
  status: AuthStatus;
  login: (payload: LoginRequest) => Promise<AuthActionResult>;
  register: (payload: RegisterRequest) => Promise<AuthActionResult>;
  logout: () => Promise<AuthActionResult>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
