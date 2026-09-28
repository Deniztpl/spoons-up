import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeekPage } from "./WeekPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));

function task(id: string, title: string, date: string, time: string | null = "09:00") {
  return {
    id,
    goal_id: null,
    rule_id: null,
    title,
    scheduled_date: date,
    occurrence_date: null,
    period_start: "2026-09-21",
    start_time: time,
    duration_minutes: time ? 60 : null,
    end_time: time ? "10:00" : null,
    block_count: null,
    status: "PENDING",
  };
}

function weekResponse(start = "2026-09-21") {
  const startsFollowingWeek = start === "2026-09-28";
  const dates = startsFollowingWeek
    ? [
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
      ]
    : [
        "2026-09-21",
        "2026-09-22",
        "2026-09-23",
        "2026-09-24",
        "2026-09-25",
        "2026-09-26",
        "2026-09-27",
      ];

  return {
    period_start: dates[0],
    days: dates.map((date) => ({
      date,
      tasks:
        !startsFollowingWeek && date === "2026-09-24"
          ? [task("41", "Plan sprint", date), task("42", "Call dentist", date, null)]
          : [],
    })),
    later_tasks: {
      count: 2,
      items: [
        { scheduled_date: "2026-10-08", start_time: "14:30", title: "Tax meeting" },
        { scheduled_date: "2026-10-12", start_time: null, title: "Renew passport" },
      ],
    },
  };
}

function todayResponse() {
  return {
    date: "2026-09-24",
    week_start: "2026-09-21",
    week_end: "2026-09-27",
    daily_habits: [],
    weekly_habits: [],
    tasks: [],
  };
}

function defaultFetch() {
  return vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/v1/today") {
      return Response.json(todayResponse());
    }
    if (request.method === "GET" && url.pathname === "/api/v1/week") {
      return Response.json(
        weekResponse(url.searchParams.has("start") ? "2026-09-28" : "2026-09-21"),
      );
    }
    if (request.method === "GET" && url.pathname === "/api/v1/areas") {
      return Response.json({ areas: [] });
    }
    if (request.method === "GET" && url.pathname === "/api/v1/goals") {
      return Response.json({ goals: [] });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/week"]}>
      <WeekPage onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("Week page", () => {
  beforeEach(() => {
    onLogout.mockClear();
  });

  it("renders the server-ordered week and only navigates between the allowed weeks", async () => {
    const fetchMock = defaultFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Sep 21 – 27")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();
    expect(screen.getAllByText("Plan sprint").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add a task on 2026-09-23" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a task on 2026-09-24" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(await screen.findByText("Sep 28 – Oct 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeEnabled();
    const followingRequest = fetchMock.mock.calls
      .map(([request]) => request as Request)
      .find((request) => {
        const url = new URL(request.url);
        return url.pathname === "/api/v1/week" && url.searchParams.has("start");
      });
    expect(new URL(followingRequest!.url).searchParams.get("start")).toBe("2026-10-01");

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(await screen.findByText("Sep 21 – 27")).toBeInTheDocument();
  });

  it("opens the shared form with today or the clicked calendar slot", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");

    await user.click(screen.getAllByRole("button", { name: "Add task" })[0]!);
    let dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toHaveAttribute("min", "2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
      clientY: 608,
    });
    dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-25");
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("09:30");
  });

  it("shows the count and list of later tasks from the week response", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "2 later tasks" }));

    const dialog = screen.getByRole("dialog", { name: "Later tasks" });
    expect(within(dialog).getByText("Tax meeting")).toBeInTheDocument();
    expect(within(dialog).getByText("Oct 8, 2026", { exact: false })).toBeInTheDocument();
    expect(within(dialog).getByText("14:30")).toBeInTheDocument();
    expect(within(dialog).getByText("Renew passport")).toBeInTheDocument();
    expect(within(dialog).getByText("No time")).toBeInTheDocument();
  });

  it("moves a task to a future calendar slot with PATCH", async () => {
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/41") {
        expect(await request.clone().json()).toEqual({
          scheduled_date: "2026-09-25",
          start_time: "10:00",
        });
        return Response.json({ ...task("41", "Plan sprint", "2026-09-25", "10:00"), completed_at: null });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(weekResponse());
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByText("Sep 21 – 27");

    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      types: ["application/x-spoons-up-task"],
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? "",
    };
    const card = screen.getAllByText("Plan sprint")[0]!.closest("article")!;
    const target = screen.getByRole("button", { name: "Add a task on 2026-09-25" });
    fireEvent.dragStart(card, { clientY: 0, dataTransfer });
    fireEvent.drop(target, { clientY: 640, dataTransfer });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([request]) =>
            request.method === "PATCH" && new URL(request.url).pathname === "/api/v1/tasks/41",
        ),
      ).toBe(true);
    });
  });

  it("edits and deletes a task through the shared form", async () => {
    let hasTask = true;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        const response = weekResponse();
        if (!hasTask) {
          response.days = response.days.map((day) => ({ ...day, tasks: [] }));
        }
        return Response.json(response);
      }
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/41") {
        hasTask = false;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole("button", { name: /Plan sprint/ }))[0]!);
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete task" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Plan sprint/ })).not.toBeInTheDocument();
    });
  });
});
