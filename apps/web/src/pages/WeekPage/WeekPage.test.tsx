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
    parent_id: null as string | null,
    step_progress: null as { done: number; total: number } | null,
    parent: null as { id: string; title: string; step_progress: { done: number; total: number } } | null,
  };
}

// The week response with extra tasks added to one of its days.
function weekWith(date: string, extraTasks: ReturnType<typeof task>[]) {
  const response = weekResponse();
  return {
    ...response,
    days: response.days.map((day) =>
      day.date === date ? { ...day, tasks: [...day.tasks, ...extraTasks] } : day,
    ),
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
        task("51", "Tax meeting", "2026-10-08", "14:30"),
        task("52", "Renew passport", "2026-10-12", null),
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
    if (request.method === "GET" && url.pathname === "/api/v1/journal") {
      return Response.json({ today: "2026-09-24", active: [], completed: [] });
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

  it("asks for Goal or Journal, then opens that form with today or the clicked slot", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");

    await user.click(screen.getAllByRole("button", { name: "Add task" })[0]!);
    let chooser = screen.getByRole("dialog", { name: "Add a task" });
    expect(chooser).toHaveTextContent("Thu, Sep 24");
    expect(within(chooser).getByRole("button", { name: "Goal task" })).toHaveFocus();
    await user.click(within(chooser).getByRole("button", { name: "Goal task" }));
    let dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toHaveAttribute("min", "2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    expect(within(dialog).queryByRole("option", { name: "No goal" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
      clientY: 608,
    });
    chooser = screen.getByRole("dialog", { name: "Add a task" });
    expect(chooser).toHaveTextContent("Fri, Sep 25 · 09:30");
    await user.click(within(chooser).getByRole("button", { name: "Journal task" }));
    dialog = screen.getByRole("dialog", { name: "Journal task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-25");
    expect(within(dialog).getByLabelText("Date")).toHaveAttribute("min", "2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("09:30");
  });

  it("plans open Journal work on a clicked slot without creating a task", async () => {
    let planned = false;
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(
          planned ? weekWith("2026-09-25", [task("60", "Buy a gift", "2026-09-25", "09:30")]) : weekResponse(),
        );
      }
      if (request.method === "GET" && url.pathname === "/api/v1/journal") {
        return Response.json({
          today: "2026-09-24",
          active: [
            {
              ...task("60", "Buy a gift", "2026-09-24", null),
              scheduled_date: null,
              due_date: null,
              completed_at: null,
              progress: { done: 0, total: 0 },
              steps: [],
            },
          ],
          completed: [],
        });
      }
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/60") {
        expect(await request.clone().json()).toEqual({
          scheduled_date: "2026-09-25",
          start_time: "09:30",
          duration_minutes: null,
          block_count: null,
        });
        planned = true;
        return Response.json({ ...task("60", "Buy a gift", "2026-09-25", "09:30") });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");

    fireEvent.click(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
      clientY: 608,
    });
    await user.click(
      within(screen.getByRole("dialog", { name: "Add a task" })).getByRole("button", {
        name: "Journal task",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Journal task" });
    await user.click(await within(dialog).findByRole("button", { name: "Buy a gift" }));
    await user.click(within(dialog).getByRole("button", { name: "Plan" }));

    expect(await screen.findByRole("button", { name: "Buy a gift, 09:30 to 10:00" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([request]) => request.method === "POST")).toBe(false);
  });

  it("shows a step's item on the calendar and asks before finishing an item with open steps", async () => {
    let finished = false;
    const item = { ...task("70", "Conference", "2026-09-24", null), step_progress: { done: 1, total: 3 } };
    const step = {
      ...task("71", "Prepare the slides", "2026-09-24", "13:00"),
      parent_id: "70",
      parent: { id: "70", title: "Conference", step_progress: { done: 1, total: 3 } },
    };
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(
          weekWith("2026-09-24", finished ? [{ ...item, status: "DONE" }] : [item, step]),
        );
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks/70/check") {
        finished = true;
        return Response.json({ ...item, status: "DONE", completed_at: "2026-09-24T09:00:00Z" });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "Prepare the slides, a step of Conference, 1 of 3 steps done, 13:00 to 10:00",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("checkbox", { name: "Conference" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Conference" });
    expect(dialog).toHaveTextContent("2 steps are not complete. Finish anyway?");
    await user.click(within(dialog).getByRole("button", { name: "Finish anyway" }));

    await waitFor(() =>
      expect(screen.queryAllByRole("checkbox", { name: "Prepare the slides" })).toHaveLength(0),
    );
    expect(fetchMock.mock.calls.filter(([request]) => request.method === "POST")).toHaveLength(1);
  });

  it("keeps finished work on an elapsed day in place and lets open work move on", async () => {
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(
          weekWith("2026-09-22", [
            task("80", "Open review", "2026-09-22"),
            { ...task("81", "Finished review", "2026-09-22", "11:00"), status: "DONE" },
          ]),
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    const open = (await screen.findByRole("button", { name: "Open review, 09:00 to 10:00" })).closest(
      "article",
    );
    const finished = screen
      .getByRole("button", { name: "Finished review, 11:00 to 10:00" })
      .closest("article");
    expect(open).toHaveAttribute("draggable", "true");
    expect(finished).toHaveAttribute("draggable", "false");
    expect(screen.queryByRole("button", { name: "Add a task on 2026-09-22" })).not.toBeInTheDocument();
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

  it("opens a later task in the shared form to delete it", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(weekResponse());
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/51") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "2 later tasks" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Later tasks" })).getByRole("button", {
        name: /Tax meeting/,
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-10-08");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete task" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([request]) =>
            request.method === "DELETE" && new URL(request.url).pathname === "/api/v1/tasks/51",
        ),
      ).toBe(true);
    });
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

  it("draws goal tasks in their area's colour and names the area on long blocks", async () => {
    const longGoalTask = {
      ...task("43", "Deep work", "2026-09-24", "13:00"),
      goal_id: "7",
      duration_minutes: 120,
      end_time: "15:00",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname === "/api/v1/today") {
          return Response.json(todayResponse());
        }
        if (url.pathname === "/api/v1/week") {
          const response = weekResponse();
          return Response.json({
            ...response,
            days: response.days.map((day) =>
              day.date === "2026-09-24" ? { ...day, tasks: [...day.tasks, longGoalTask] } : day,
            ),
          });
        }
        if (url.pathname === "/api/v1/areas") {
          return Response.json({
            areas: [
              {
                id: "3",
                name: "Coding",
                color: "GREEN",
                archived_at: null,
                unarchived_at: null,
                created_at: "2026-09-22T09:00:00Z",
              },
            ],
          });
        }
        if (url.pathname === "/api/v1/goals") {
          return Response.json({
            goals: [
              {
                id: "7",
                area_id: "3",
                title: "Deep work",
                weekly_target: 2,
                created_at: "2026-09-22T09:00:00Z",
                rules: [],
              },
            ],
          });
        }
        throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
      }),
    );
    renderPage();

    const block = await screen.findByRole("button", { name: "Deep work, Coding, 13:00 to 15:00" });
    const card = block.closest("article")!;
    expect(card).toHaveClass("area-green");
    expect(within(card).getByText("Coding")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Plan sprint, 09:00 to 10:00" }).closest("article"),
    ).not.toHaveClass("area-green");
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
