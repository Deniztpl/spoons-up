import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeekPage } from "./WeekPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));

function task(id: string, title: string, date: string, time: string | null = "09:00") {
  return {
    id,
    goal_id: null as string | null,
    rule_id: null as string | null,
    title,
    scheduled_date: date,
    occurrence_date: null as string | null,
    period_start: "2026-09-21",
    start_time: time,
    duration_minutes: time ? 60 : null,
    end_time: time ? "10:00" : null,
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

// A goal row's three figures in the hours panel, such as "8h done · 2h planned · 0h not planned".
function hoursOf(row: HTMLElement) {
  return ["done", "planned", "not planned"]
    .map((label) => within(row).getByText(label).parentElement!.textContent)
    .join(" · ");
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

// The Monday of the week holding a date, as the server resolves `start`.
function mondayOf(value: string) {
  return addDays(value, -((new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7));
}

function weekResponse(start = "2026-09-21") {
  const dates = Array.from({ length: 7 }, (_, offset) => addDays(start, offset));

  return {
    period_start: dates[0],
    days: dates.map((date) => ({
      date,
      tasks:
        date === "2026-09-24"
          ? [task("41", "Plan sprint", date), task("42", "Call dentist", date, null)]
          : [],
    })),
    later_tasks: {
      count: 2,
      items: [
        task("51", "Tax meeting", "2026-10-15", "14:30"),
        task("52", "Renew passport", "2026-10-19", null),
      ],
    },
    goals: [] as Array<Record<string, unknown>>,
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
      const start = url.searchParams.get("start");
      return Response.json(weekResponse(start ? mondayOf(start) : "2026-09-21"));
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

// Presses one element, moves the pointer over another and lets go there.
function drag(from: Element, over: Element, { fromY = 0, toY }: { fromY?: number; toY: number }) {
  fireEvent.pointerDown(from, { button: 0, clientX: 10, clientY: fromY });
  fireEvent.pointerMove(over, { clientX: 40, clientY: toY });
  fireEvent.pointerUp(over, { clientX: 40, clientY: toY });
}

function patchBodies(fetchMock: ReturnType<typeof vi.fn>, path: string) {
  return Promise.all(
    fetchMock.mock.calls
      .map(([request]) => request as Request)
      .filter((request) => request.method === "PATCH" && new URL(request.url).pathname === path)
      .map((request) => request.clone().json()),
  );
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
    localStorage.clear();
  });

  it("splits each goal's hours into done, planned and not planned, and remembers a closed panel", async () => {
    let checked = false;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json({
          ...weekResponse(),
          goals: [
            { goal_id: "7", area_id: "3", title: "Beats", target: 20, done: checked ? 9 : 8, planned: 4.5 },
            { goal_id: "8", area_id: "3", title: "Mixing", target: 2, done: 1.5, planned: 2 },
          ],
        });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({
          areas: [
            {
              id: "3",
              name: "Music",
              color: "GREEN",
              archived_at: null,
              unarchived_at: null,
              created_at: "2026-09-22T09:00:00Z",
            },
          ],
        });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks/41/check") {
        checked = true;
        return Response.json({ ...task("41", "Plan sprint", "2026-09-24"), status: "DONE" });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { unmount } = renderPage();

    const panel = await screen.findByRole("complementary", { name: "Hours" });
    const music = await within(panel).findByRole("region", { name: "Music" });
    expect(music).toHaveClass("area-green");
    const [beats, mixing] = within(music).getAllByRole("listitem");
    expect(beats).toHaveTextContent("Beats20h");
    expect(hoursOf(beats!)).toBe("8h done · 4h 30m planned · 7h 30m not planned");
    // Placing more than the target leaves nothing unplanned and shows the extra.
    expect(mixing).toHaveTextContent("+1h 30m");
    expect(hoursOf(mixing!)).toBe("1h 30m done · 2h planned · 0h not planned");

    // Checking work reads the week again, so the hours follow.
    await user.click(screen.getAllByRole("checkbox", { name: "Plan sprint" })[0]!);
    await waitFor(() =>
      expect(hoursOf(within(panel).getAllByRole("listitem")[0]!)).toBe(
        "9h done · 4h 30m planned · 6h 30m not planned",
      ),
    );

    const toggle = screen.getByRole("button", { name: "Hours" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("complementary", { name: "Hours" })).not.toBeInTheDocument();

    unmount();
    renderPage();
    await screen.findByText("Sep 21 – 27");
    expect(screen.getByRole("button", { name: "Hours" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("complementary", { name: "Hours" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous week" })).toBeEnabled();

    // The third week is the last one.
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(await screen.findByText("Oct 5 – 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
    const starts = fetchMock.mock.calls
      .map(([request]) => new URL((request as Request).url))
      .filter((url) => url.pathname === "/api/v1/week" && url.searchParams.has("start"))
      .map((url) => url.searchParams.get("start"));
    expect(starts).toEqual(["2026-10-01", "2026-10-08"]);

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Sep 28 – Oct 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(await screen.findByText("Sep 21 – 27")).toBeInTheDocument();
  });

  it("asks for Goal or Journal, then opens that form with today or the double-clicked slot", async () => {
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

    // A single click on an empty slot no longer opens anything.
    fireEvent.click(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
      clientY: 608,
      detail: 1,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
      clientY: 608,
    });
    chooser = screen.getByRole("dialog", { name: "Add a task" });
    expect(chooser).toHaveTextContent("Fri, Sep 25 · 09:30 · 1h");
    await user.click(within(chooser).getByRole("button", { name: "Journal task" }));
    dialog = screen.getByRole("dialog", { name: "Journal task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-25");
    expect(within(dialog).getByLabelText("Date")).toHaveAttribute("min", "2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("09:30");
    expect(within(dialog).getByRole("spinbutton", { name: "Duration" })).toHaveAttribute(
      "aria-valuetext",
      "1 hour",
    );
  });

  it("draws a new task's range on an empty slot and opens the form with it", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");

    const slot = screen.getByRole("button", { name: "Add a task on 2026-09-25" });
    // From the 10:00 line down to the 14:00 line.
    drag(slot, slot, { fromY: 640, toY: 896 });

    const chooser = screen.getByRole("dialog", { name: "Add a task" });
    expect(chooser).toHaveTextContent("Fri, Sep 25 · 10:00 · 4h");
    await user.click(within(chooser).getByRole("button", { name: "Goal task" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-25");
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("10:00");
    expect(within(dialog).getByRole("spinbutton", { name: "Duration" })).toHaveAttribute(
      "aria-valuetext",
      "4 hours",
    );
  });

  it("drops a goal from the hours panel on a slot and opens its form with that goal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/v1/today") {
          return Response.json(todayResponse());
        }
        if (request.method === "GET" && url.pathname === "/api/v1/week") {
          return Response.json({
            ...weekResponse(),
            goals: [{ goal_id: "7", area_id: "3", title: "Beats", target: 20, done: 0, planned: 0 }],
          });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/areas") {
          return Response.json({
            areas: [
              {
                id: "3",
                name: "Music",
                color: "GREEN",
                archived_at: null,
                unarchived_at: null,
                created_at: "2026-09-22T09:00:00Z",
              },
            ],
          });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/goals") {
          return Response.json({
            goals: [
              {
                id: "7",
                area_id: "3",
                title: "Beats",
                weekly_target: 20,
                created_at: "2026-09-22T09:00:00Z",
                rules: [],
              },
            ],
          });
        }
        throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
      }),
    );
    const user = userEvent.setup();
    renderPage();
    const panel = await screen.findByRole("complementary", { name: "Hours" });
    const beats = await within(panel).findByRole("listitem");

    // Dropped on Friday at 19:00, it proposes an hour there with Beats already chosen.
    drag(beats, screen.getByRole("button", { name: "Add a task on 2026-09-25" }), { toY: 1216 });

    let dialog = screen.getByRole("dialog", { name: "New task" });
    await waitFor(() => expect(within(dialog).getByLabelText("Goal")).toHaveValue("7"));
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-25");
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("19:00");
    expect(within(dialog).getByRole("spinbutton", { name: "Duration" })).toHaveAttribute(
      "aria-valuetext",
      "1 hour",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    // On a day's untimed row it has no time; on an elapsed day it opens nothing.
    drag(beats, screen.getByRole("group", { name: "Untimed tasks for 2026-09-26" }), { toY: 0 });
    dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-26");
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    drag(beats, screen.getByRole("group", { name: "Untimed tasks for 2026-09-23" }), { toY: 0 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("plans open Journal work on a double-clicked slot without creating a task", async () => {
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
          duration_minutes: 60,
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

    fireEvent.doubleClick(screen.getByRole("button", { name: "Add a task on 2026-09-25" }), {
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

    expect(await screen.findByRole("button", { name: "Buy a gift, 09:30 to 10:00, 1 hour" })).toBeInTheDocument();
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
        name: "Prepare the slides, a step of Conference, 1 of 3 steps done, 13:00 to 10:00, 1 hour",
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
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/80") {
        return Response.json(task("80", "Open review", "2026-09-24", "10:00"));
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();

    const open = (
      await screen.findByRole("button", { name: "Open review, 09:00 to 10:00, 1 hour" })
    ).closest("article")!;
    const finished = screen
      .getByRole("button", { name: "Finished review, 11:00 to 10:00, 1 hour" })
      .closest("article")!;
    const today = screen.getByRole("button", { name: "Add a task on 2026-09-24" });
    expect(screen.queryByRole("button", { name: "Add a task on 2026-09-22" })).not.toBeInTheDocument();

    // Finished work on an elapsed day does not move, and no elapsed day takes a drop.
    drag(finished, today, { toY: 640 });
    drag(open, screen.getByRole("group", { name: "Untimed tasks for 2026-09-23" }), { toY: 10 });
    expect(await patchBodies(fetchMock, "/api/v1/tasks/81")).toEqual([]);
    expect(await patchBodies(fetchMock, "/api/v1/tasks/80")).toEqual([]);

    drag(open, today, { toY: 640 });
    await waitFor(async () =>
      expect(await patchBodies(fetchMock, "/api/v1/tasks/80")).toEqual([
        { scheduled_date: "2026-09-24", start_time: "10:00" },
      ]),
    );
  });

  it("shows the count and list of later tasks from the week response", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "2 later tasks" }));

    const dialog = screen.getByRole("dialog", { name: "Later tasks" });
    expect(within(dialog).getByText("Tax meeting")).toBeInTheDocument();
    expect(within(dialog).getByText("Oct 15, 2026", { exact: false })).toBeInTheDocument();
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
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-10-15");
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

  it("moves a task with the pointer and resizes it from its bottom edge", async () => {
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/41") {
        return Response.json(task("41", "Plan sprint", "2026-09-24"));
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

    const card = screen.getAllByText("Plan sprint")[0]!.closest("article")!;
    drag(card, screen.getByRole("button", { name: "Add a task on 2026-09-25" }), { toY: 640 });
    await waitFor(async () =>
      expect(await patchBodies(fetchMock, "/api/v1/tasks/41")).toHaveLength(1),
    );

    // From 09:00, the bottom edge pulled down to the 11:00 line makes two hours.
    drag(
      screen.getByTestId("resize-41"),
      screen.getByRole("button", { name: "Add a task on 2026-09-24" }),
      { fromY: 640, toY: 704 },
    );
    await waitFor(async () =>
      expect(await patchBodies(fetchMock, "/api/v1/tasks/41")).toEqual([
        { scheduled_date: "2026-09-25", start_time: "10:00" },
        { duration_minutes: 120 },
      ]),
    );
  });

  it("shows a moved task at once and puts it back when the save fails", async () => {
    let failMove: (() => void) | undefined;
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/41") {
        return new Promise<Response>((resolve) => {
          failMove = () =>
            resolve(
              Response.json(
                { code: "validation_error", message: "Task could not be saved" },
                { status: 422 },
              ),
            );
        });
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

    const card = screen.getAllByText("Plan sprint")[0]!.closest("article")!;
    drag(card, screen.getByRole("button", { name: "Add a task on 2026-09-25" }), { toY: 640 });

    expect(
      await screen.findByRole("button", { name: "Plan sprint, 10:00 to 11:00, 1 hour" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(failMove).toBeDefined());
    failMove?.();

    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be saved");
    expect(
      screen.getByRole("button", { name: "Plan sprint, 09:00 to 10:00, 1 hour" }),
    ).toBeInTheDocument();
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

    const block = await screen.findByRole("button", {
      name: "Deep work, Coding, 13:00 to 15:00, 2 hours",
    });
    const card = block.closest("article")!;
    expect(card).toHaveClass("area-green");
    expect(within(card).getByText("Coding")).toBeInTheDocument();
    expect(within(card).getByText("2h")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Plan sprint, 09:00 to 10:00, 1 hour" }).closest("article"),
    ).not.toHaveClass("area-green");
  });

  it("selects a task with a click and opens it with Enter or a double-click", async () => {
    vi.stubGlobal("fetch", defaultFetch());
    const user = userEvent.setup();
    renderPage();

    const planSprint = (await screen.findAllByRole("button", { name: /^Plan sprint/ }))[0]!;
    await user.click(planSprint);
    expect(planSprint).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Enter opens the task picked with the pointer, even once focus has moved on.
    planSprint.blur();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Edit task" })).toBeInTheDocument();
    // Shortcuts stay quiet inside a dialog.
    await user.keyboard("{Delete}");
    expect(screen.queryByRole("dialog", { name: "Delete task" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    planSprint.blur();
    await user.keyboard("{Escape}");
    expect(planSprint).toHaveAttribute("aria-pressed", "false");
  });

  it("copies a task and pastes it at the clicked quarter hour or untimed row", async () => {
    const goalTask = {
      ...task("43", "Deep work", "2026-09-24", "13:00"),
      goal_id: "7",
      rule_id: "21",
      duration_minutes: 240,
      end_time: "17:00",
    };
    const step = {
      ...task("44", "Rehearse", "2026-09-24", "18:00"),
      parent_id: "70",
      parent: { id: "70", title: "Conference", step_progress: { done: 0, total: 2 } },
    };
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        return Response.json(weekWith("2026-09-24", [goalTask, step]));
      }
      if (request.method === "GET" && ["/api/v1/areas", "/api/v1/goals"].includes(url.pathname)) {
        return Response.json(url.pathname === "/api/v1/areas" ? { areas: [] } : { goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
        return Response.json(task("90", "Copy", "2026-09-26"), { status: 201 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");
    const posts = () =>
      Promise.all(
        fetchMock.mock.calls
          .map(([request]) => request)
          .filter((request) => request.method === "POST")
          .map((request) => request.clone().json()),
      );

    // A repeating goal task copies as one more task of its goal.
    await user.click(screen.getAllByRole("button", { name: /^Deep work/ })[0]!);
    await user.keyboard("{Control>}c{/Control}");
    fireEvent.click(screen.getByRole("button", { name: "Add a task on 2026-09-26" }), {
      clientY: 640,
      detail: 1,
    });
    await user.keyboard("{Control>}v{/Control}");
    await waitFor(async () =>
      expect(await posts()).toEqual([
        { goal_id: "7", scheduled_date: "2026-09-26", start_time: "10:00", duration_minutes: 240 },
      ]),
    );

    // Journal work copies as a new item with its title, here into a day's untimed row.
    await user.click(screen.getAllByRole("button", { name: /^Plan sprint/ })[0]!);
    await user.keyboard("{Meta>}c{/Meta}");
    fireEvent.click(screen.getByRole("group", { name: "Untimed tasks for 2026-09-25" }), {
      detail: 1,
    });
    await user.keyboard("{Meta>}v{/Meta}");
    await waitFor(async () => expect(await posts()).toHaveLength(2));
    expect((await posts())[1]).toEqual({
      title: "Plan sprint",
      scheduled_date: "2026-09-25",
      start_time: null,
      duration_minutes: 60,
    });

    // A step is not copied, so the last copy is pasted again.
    await user.click(screen.getAllByRole("button", { name: /^Rehearse/ })[0]!);
    await user.keyboard("{Control>}c{/Control}");
    fireEvent.click(screen.getByRole("group", { name: "Untimed tasks for 2026-09-27" }), {
      detail: 1,
    });
    await user.keyboard("{Control>}v{/Control}");
    await waitFor(async () => expect(await posts()).toHaveLength(3));
    expect((await posts())[2]).toMatchObject({ title: "Plan sprint", scheduled_date: "2026-09-27" });
  });

  it("deletes the selected task with the Delete key after asking", async () => {
    let deleted = false;
    const fetchMock = defaultFetch();
    fetchMock.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        const response = weekResponse();
        return Response.json(
          deleted
            ? {
                ...response,
                days: response.days.map((day) => ({
                  ...day,
                  tasks: day.tasks.filter((item) => item.id !== "41"),
                })),
              }
            : response,
        );
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/41") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click((await screen.findAllByRole("button", { name: /^Plan sprint/ }))[0]!);
    await user.keyboard("{Delete}");
    let dialog = screen.getByRole("dialog", { name: "Delete task" });
    expect(dialog).toHaveTextContent("Delete “Plan sprint”?");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([request]) => request.method === "DELETE")).toBe(false);

    await user.keyboard("{Backspace}");
    dialog = screen.getByRole("dialog", { name: "Delete task" });
    expect(within(dialog).getByRole("button", { name: "Delete task" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryAllByRole("button", { name: /^Plan sprint/ })).toHaveLength(0));
    expect(fetchMock.mock.calls.filter(([request]) => request.method === "DELETE")).toHaveLength(1);
  });

  it("asks Only this or This and following before a repeating task moves or is deleted", async () => {
    const repeating = {
      ...task("43", "Deep work", "2026-09-24", "13:00"),
      goal_id: "7",
      rule_id: "21",
      occurrence_date: "2026-09-24",
      end_time: "14:00",
    };
    const elapsed = {
      ...task("45", "Old session", "2026-09-22", "13:00"),
      goal_id: "7",
      rule_id: "21",
      occurrence_date: "2026-09-22",
      end_time: "14:00",
    };
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return Response.json(todayResponse());
      }
      if (request.method === "GET" && url.pathname === "/api/v1/week") {
        const response = weekWith("2026-09-24", [repeating]);
        return Response.json({
          ...response,
          days: response.days.map((day) =>
            day.date === "2026-09-22" ? { ...day, tasks: [elapsed] } : day,
          ),
        });
      }
      if (request.method === "GET" && ["/api/v1/areas", "/api/v1/goals"].includes(url.pathname)) {
        return Response.json(url.pathname === "/api/v1/areas" ? { areas: [] } : { goals: [] });
      }
      if (request.method === "PATCH") {
        return Response.json(repeating);
      }
      if (request.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Sep 21 – 27");
    const card = () => screen.getAllByRole("button", { name: /^Deep work, 13:00/ })[0]!.closest("article")!;
    const friday = screen.getByRole("button", { name: "Add a task on 2026-09-25" });
    const writes = () =>
      Promise.all(
        fetchMock.mock.calls
          .map(([request]) => request)
          .filter((request) => request.method === "PATCH" || request.method === "DELETE")
          .map(async (request) => ({
            call: `${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`,
            body: request.method === "PATCH" ? await request.clone().json() : null,
          })),
      );

    // While the question is open the task shows where it was dropped; Escape puts it back.
    drag(card(), friday, { toY: 640 });
    let dialog = screen.getByRole("dialog", { name: "Change “Deep work”?" });
    expect(within(dialog).getByRole("button", { name: "Only this task" })).toHaveFocus();
    expect(screen.getAllByRole("button", { name: /^Deep work, 10:00 to 11:00/ }).length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Deep work, 13:00 to 14:00/ }).length).toBeGreaterThan(0);
    expect(await writes()).toEqual([]);

    // This and following sends the whole drop; where the sessions end up is the server's call,
    // so nothing is left on the drop day meanwhile.
    drag(card(), friday, { toY: 640 });
    await user.click(screen.getByRole("button", { name: "This and following" }));
    await waitFor(async () =>
      expect(await writes()).toEqual([
        {
          call: "PATCH /api/v1/tasks/43/repeat",
          body: { scheduled_date: "2026-09-25", start_time: "10:00", duration_minutes: 60 },
        },
      ]),
    );
    expect(screen.queryAllByRole("button", { name: /^Deep work, 10:00/ })).toHaveLength(0);

    // Enter picks Only this, a plain move of the one task.
    await screen.findAllByRole("button", { name: /^Deep work, 13:00/ });
    drag(card(), friday, { toY: 640 });
    await user.keyboard("{Enter}");
    await waitFor(async () => expect(await writes()).toHaveLength(2));
    expect((await writes())[1]).toEqual({
      call: "PATCH /api/v1/tasks/43",
      body: { scheduled_date: "2026-09-25", start_time: "10:00" },
    });

    // A move to another day at the same time asks too, since This and following skips the
    // sessions up to the drop day.
    await screen.findAllByRole("button", { name: /^Deep work, 13:00/ });
    drag(card(), friday, { toY: 832 });
    expect(screen.getByRole("dialog", { name: "Change “Deep work”?" })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(async () => expect(await writes()).toHaveLength(3));
    expect((await writes())[2]).toEqual({
      call: "PATCH /api/v1/tasks/43",
      body: { scheduled_date: "2026-09-25" },
    });

    // Resizing a repeating task on an elapsed day changes only that task, without asking.
    drag(screen.getByTestId("resize-45"), friday, { fromY: 896, toY: 960 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(async () => expect(await writes()).toHaveLength(4));
    expect((await writes())[3]).toEqual({
      call: "PATCH /api/v1/tasks/45",
      body: { duration_minutes: 120 },
    });

    // Deleting asks too, and This and following ends the schedule.
    await screen.findAllByRole("button", { name: /^Deep work, 13:00/ });
    await user.click(screen.getAllByRole("button", { name: /^Deep work, 13:00/ })[0]!);
    await user.keyboard("{Delete}");
    dialog = screen.getByRole("dialog", { name: "Delete “Deep work”?" });
    await user.click(within(dialog).getByRole("button", { name: "This and following" }));
    await waitFor(async () => expect(await writes()).toHaveLength(5));
    expect((await writes())[4]).toEqual({
      call: "DELETE /api/v1/tasks/43?scope=repeat",
      body: null,
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

    await user.dblClick((await screen.findAllByRole("button", { name: /Plan sprint/ }))[0]!);
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(within(dialog).getByLabelText("Date")).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete task" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Plan sprint/ })).not.toBeInTheDocument();
    });
  });
});
