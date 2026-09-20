import { createApiClient } from "@spoons-up/api-client";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const apiClient = createApiClient({
  baseUrl,
  credentials: "include",
});
