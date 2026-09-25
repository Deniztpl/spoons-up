import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { setAuthChecking } from "../features/auth/session";

function tokenResponse(accessToken = "access-token") {
  return Response.json({
    access_token: accessToken,
    refresh_token: "ignored-by-web",
    token_type: "bearer",
  });
}

function authError(code: string, message: string, status = 401) {
  return Response.json({ code, message }, { status });
}

function emptyTodayResponse() {
  return Response.json({
    date: "2026-09-24",
    week_start: "2026-09-21",
    week_end: "2026-09-27",
    daily_habits: [],
    weekly_habits: [],
    tasks: [],
  });
}

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("web authentication", () => {
  beforeEach(() => {
    setAuthChecking();
  });

  it("shows login when the refresh cookie cannot restore a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => authError("invalid_token", "Invalid or expired token")),
    );

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session");
    expect(
      await screen.findByRole("heading", { name: "Sign in to your space" }),
    ).toBeInTheDocument();
  });

  it("moves between the login and register routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => authError("invalid_token", "Invalid or expired token")),
    );
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("link", { name: "Create an account" }));
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Sign in" }));
    expect(
      screen.getByRole("heading", { name: "Sign in to your space" }),
    ).toBeInTheDocument();
  });

  it("restores the shell and redirects public routes for an authenticated session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) =>
        new URL(request.url).pathname === "/api/v1/today"
          ? emptyTodayResponse()
          : tokenResponse(),
      ),
    );

    renderApp("/login");

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("signs in and routes to the protected shell", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/today") {
        return emptyTodayResponse();
      }
      return pathname === "/api/v1/auth/refresh"
        ? authError("invalid_token", "Invalid or expired token")
        : tokenResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp("/login");

    await screen.findByRole("heading", { name: "Sign in to your space" });
    await user.type(screen.getByLabelText("Email"), " deniz@example.com ");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
    const loginRequest = fetchMock.mock.calls
      .map(([request]) => request)
      .find((request) => new URL(request.url).pathname === "/api/v1/auth/login");
    expect(await loginRequest?.clone().json()).toEqual({
      email: "deniz@example.com",
      password: "password123",
    });
  });

  it("registers with the browser timezone and routes to the shell", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Europe/Istanbul",
    });
    let registerPayload: unknown;
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/auth/refresh") {
        return authError("invalid_token", "Invalid or expired token");
      }
      if (pathname === "/api/v1/auth/register") {
        registerPayload = await request.clone().json();
      }
      if (pathname === "/api/v1/today") {
        return emptyTodayResponse();
      }
      return tokenResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp("/register");

    await screen.findByRole("heading", { name: "Create your account" });
    expect(screen.getByText("Europe/Istanbul")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(registerPayload).toEqual({
      email: "new@example.com",
      password: "password123",
      timezone: "Europe/Istanbul",
    });
  });

  it("falls back to UTC when the browser has no timezone", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => authError("invalid_token", "Invalid or expired token")),
    );
    renderApp("/register");

    expect(await screen.findByText("UTC")).toBeInTheDocument();
  });

  it.each([
    ["/login", "invalid_credentials", "Invalid email or password", "Sign in"],
    ["/register", "email_taken", "Email already registered", "Create account"],
  ])("shows application errors on %s", async (path, code, message, buttonName) => {
    const fetchMock = vi.fn(async (request: Request) => {
      if (new URL(request.url).pathname === "/api/v1/auth/refresh") {
        return authError("invalid_token", "Invalid or expired token");
      }
      return authError(code, message, code === "email_taken" ? 409 : 401);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp(path);

    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "deniz@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: buttonName }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("shows field validation and network errors", async () => {
    let loginAttempts = 0;
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/auth/refresh") {
        return authError("invalid_token", "Invalid or expired token");
      }
      loginAttempts += 1;
      if (loginAttempts === 1) {
        return Response.json(
          {
            code: "validation_error",
            message: "Request body is invalid",
            fields: { email: "invalid format" },
          },
          { status: 422 },
        );
      }
      throw new TypeError("Network unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp("/login");

    await screen.findByLabelText("Email");
    await user.type(screen.getByLabelText("Email"), "deniz@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("invalid format")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Request body is invalid");

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach Spoons Up",
    );
  });

  it("logs out successfully and keeps the shell when logout cannot reach the API", async () => {
    let failLogout = true;
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/v1/auth/refresh") {
        return tokenResponse();
      }
      if (pathname === "/api/v1/today") {
        return emptyTodayResponse();
      }
      if (pathname === "/api/v1/auth/logout" && failLogout) {
        throw new TypeError("Network unavailable");
      }
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole("heading", { name: "Today" });
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try logging out again",
    );
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();

    failLogout = false;
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(
      await screen.findByRole("heading", { name: "Sign in to your space" }),
    ).toBeInTheDocument();
  });

  it("redirects an unknown unauthenticated route to login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => authError("invalid_token", "Invalid or expired token")),
    );

    renderApp("/not-a-page");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Sign in to your space" }),
      ).toBeInTheDocument();
    });
  });
});
