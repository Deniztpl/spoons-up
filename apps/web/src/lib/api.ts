import { createApiClient } from "@spoons-up/api-client";

import {
  getAccessToken,
  setAuthenticated,
  setUnauthenticated,
} from "../auth/session";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const browserFetch = (request: Request) => globalThis.fetch(request);

export const authApiClient = createApiClient({
  baseUrl,
  credentials: "include",
  fetch: browserFetch,
});

let refreshPromise: Promise<string | null> | null = null;

function requestWithToken(request: Request, token: string) {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(request, { headers });
}

async function performRefresh() {
  try {
    const { data } = await authApiClient.POST("/api/v1/auth/refresh");
    if (data) {
      setAuthenticated(data.access_token);
      return data.access_token;
    }
  } catch {
    // A network failure means the cookie could not be used to restore the session.
  }

  setUnauthenticated();
  return null;
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function authenticatedFetch(input: Request) {
  const tokenUsed = getAccessToken();
  const request = tokenUsed ? requestWithToken(input, tokenUsed) : input;
  const retryRequest = request.clone();
  const response = await globalThis.fetch(request);

  if (response.status !== 401) {
    return response;
  }

  const currentToken = getAccessToken();
  const nextToken =
    currentToken && currentToken !== tokenUsed ? currentToken : await refreshSession();

  if (!nextToken) {
    return response;
  }

  return globalThis.fetch(requestWithToken(retryRequest, nextToken));
}

export const apiClient = createApiClient({
  baseUrl,
  credentials: "include",
  fetch: authenticatedFetch,
});
