import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodayPage } from "./TodayPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));

function todayHabit(id: string, title: string, done: boolean) {
  return { id, area_id: "3", title, done };
}

function todayResponse(overrides: Record<string, unknown> = {}) {
  return Response.json({
    date: "2026-09-24",
    week_start: "2026-09-21",
    week_end: "2026-09-27",
    daily_habits: [todayHabit("12", "Read", false), todayHabit("13", "Stretch", true)],
    weekly_habits: [todayHabit("15", "Call home", false)],
    tasks: [],
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <TodayPage onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("Today page", () => {
  beforeEach(() => {
    onLogout.mockClear();
  });

  it("shows today's daily habits and switches to the week's habits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => todayResponse()),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("checkbox", { name: "Read" })).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Thursday, Sep 24")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Stretch" })).toBeChecked();
    expect(screen.getByRole("button", { name: /Add goal/ })).toBeDisabled();

    const views = screen.getByRole("group", { name: "Today views" });
    expect(within(views).getByRole("button", { name: "Daily" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(views).getByRole("button", { name: "Weekly" }));

    expect(screen.getByText("Sep 21 – 27")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Call home" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add goal/ })).not.toBeInTheDocument();
  });

  it("checks off and undoes habits with the date from the today response", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse();
      }
      if (request.method === "POST" && url.pathname === "/api/v1/habits/12/check") {
        expect(await request.clone().json()).toEqual({ date: "2026-09-24" });
        return Response.json(
          {
            habit_id: "12",
            period_type: "DAY",
            period_start: "2026-09-24",
            completed_at: "2026-09-24T07:30:00Z",
          },
          { status: 201 },
        );
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/habits/13/check") {
        expect(url.searchParams.get("date")).toBe("2026-09-24");
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Read" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Read" })).toBeChecked();
    });

    await user.click(screen.getByRole("checkbox", { name: "Stretch" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Stretch" })).not.toBeChecked();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats a habit that is already checked off as done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) =>
        request.method === "POST"
          ? Response.json(
              { code: "already_checked", message: "Habit already checked" },
              { status: 409 },
            )
          : todayResponse(),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Read" }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Read" })).toBeChecked();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a habit unchecked and explains why when check-off fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) =>
        request.method === "POST"
          ? Response.json({ code: "not_found", message: "Not found" }, { status: 404 })
          : todayResponse(),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Read" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This habit no longer exists.",
    );
    expect(screen.getByRole("checkbox", { name: "Read" })).not.toBeChecked();
  });

  it("points to areas when there are no habits yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => todayResponse({ daily_habits: [], weekly_habits: [] })),
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "No daily habits yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Areas" })).toHaveAttribute(
      "href",
      "/areas",
    );
  });

  it("shows an error when today cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network unavailable");
      }),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach Spoons Up.",
    );
  });
});
