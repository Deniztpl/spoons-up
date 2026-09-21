import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAccessToken,
  getAuthStatus,
  setAuthenticated,
  setUnauthenticated,
} from "../auth/session";
import { authenticatedFetch } from "./api";

function tokenResponse(accessToken: string) {
  return Response.json({
    access_token: accessToken,
    refresh_token: "ignored-by-web",
    token_type: "bearer",
  });
}

describe("authenticated API fetch", () => {
  beforeEach(() => {
    setUnauthenticated();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("adds the in-memory access token without using browser storage", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      void request;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    setAuthenticated("access-one");
    await authenticatedFetch(new Request("http://localhost:8000/api/v1/protected"));

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.headers.get("Authorization")).toBe("Bearer access-one");
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    expect(getAccessToken()).toBe("access-one");
  });

  it("refreshes after a 401 and retries a request body once", async () => {
    const protectedRequests: Array<{ authorization: string | null; body: string }> = [];
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/auth/refresh") {
        return tokenResponse("access-two");
      }

      protectedRequests.push({
        authorization: request.headers.get("Authorization"),
        body: await request.clone().text(),
      });
      return new Response(null, {
        status: protectedRequests.length === 1 ? 401 : 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthenticated("access-one");

    const response = await authenticatedFetch(
      new Request("http://localhost:8000/api/v1/protected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Keep this body" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(protectedRequests).toEqual([
      {
        authorization: "Bearer access-one",
        body: JSON.stringify({ title: "Keep this body" }),
      },
      {
        authorization: "Bearer access-two",
        body: JSON.stringify({ title: "Keep this body" }),
      },
    ]);
  });

  it("shares one refresh across concurrent 401 responses", async () => {
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/auth/refresh") {
        refreshCalls += 1;
        await refreshGate;
        return tokenResponse("shared-access");
      }

      return new Response(null, {
        status:
          request.headers.get("Authorization") === "Bearer shared-access" ? 200 : 401,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthenticated("expired-access");

    const first = authenticatedFetch(
      new Request("http://localhost:8000/api/v1/protected/one"),
    );
    const second = authenticatedFetch(
      new Request("http://localhost:8000/api/v1/protected/two"),
    );
    releaseRefresh();

    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it("clears the session and does not retry when refresh fails", async () => {
    let protectedCalls = 0;
    const fetchMock = vi.fn(async (request: Request) => {
      if (new URL(request.url).pathname === "/api/v1/auth/refresh") {
        return Response.json(
          { code: "invalid_token", message: "Invalid or expired token" },
          { status: 401 },
        );
      }
      protectedCalls += 1;
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthenticated("expired-access");

    const response = await authenticatedFetch(
      new Request("http://localhost:8000/api/v1/protected"),
    );

    expect(response.status).toBe(401);
    expect(protectedCalls).toBe(1);
    expect(getAuthStatus()).toBe("unauthenticated");
    expect(getAccessToken()).toBeNull();
  });
});
