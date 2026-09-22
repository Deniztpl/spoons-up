import { apiClient, authApiClient } from "../../../lib/api";
import type { LoginRequest, RegisterRequest } from "../AuthContext";

export function login(payload: LoginRequest) {
  return authApiClient.POST("/api/v1/auth/login", { body: payload });
}

export function register(payload: RegisterRequest) {
  return authApiClient.POST("/api/v1/auth/register", { body: payload });
}

export function logout() {
  return apiClient.POST("/api/v1/auth/logout");
}
