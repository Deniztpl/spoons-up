import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodayPage } from "./TodayPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));

function todayHabit(id: string, title: string, done: boolean) {
  return { id, area_id: "3", title, done };
}

function todayTask(
  id: string,
  title: string,
  times: [string | null, string | null],
  blockCount: number | null,
  status: "PENDING" | "DONE" = "PENDING",
) {
  return {
    id,
    goal_id: "7",
    rule_id: "21",
    title,
    start_time: times[0],
    duration_minutes: 60,
    end_time: times[1],
    block_count: blockCount,
    status,
    scheduled_date: "2026-09-24",
    occurrence_date: "2026-09-24",
    period_start: "2026-09-21",
    parent_id: null,
    step_progress: null,
    parent: null,
  };
}

// Goal-less work: a Journal task planned on the day.
function journalTask(id: string, title: string, fields: Record<string, unknown> = {}) {
  return {
    ...todayTask(id, title, [null, null], null),
    goal_id: null,
    rule_id: null,
    duration_minutes: null,
    occurrence_date: null,
    ...fields,
  };
}

function taskResponse(task: ReturnType<typeof todayTask>, status: "PENDING" | "DONE") {
  return Response.json({
    ...task,
    rule_id: "21",
    status,
    completed_at: status === "DONE" ? "2026-09-24T09:00:00Z" : null,
  });
}

function area(id: string, name: string) {
  return { id, name, archived_at: null, unarchived_at: null, created_at: "2026-09-22T09:00:00Z" };
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

function progressResponse(areas: unknown[] = []) {
  return {
    period_start: "2026-09-21",
    period_end: "2026-09-27",
    percent: areas.length > 0 ? 50 : null,
    areas,
  };
}

// The page also reads this week's progress for its side panel.
function stubFetch(handler: (request: Request) => Promise<Response>) {
  vi.stubGlobal("fetch", async (request: Request) =>
    new URL(request.url).pathname === "/api/v1/progress"
      ? Response.json(progressResponse())
      : handler(request),
  );
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
    stubFetch(
      vi.fn(async () => todayResponse()),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("checkbox", { name: "Read" })).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Thursday, Sep 24")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Stretch" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Add goal task" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add Journal task" })).toBeEnabled();

    const views = screen.getByRole("group", { name: "Today views" });
    expect(within(views).getByRole("button", { name: "Daily" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(views).getByRole("button", { name: "Weekly" }));

    expect(screen.getByText("Sep 21 – 27")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Call home" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add .* task$/ })).not.toBeInTheDocument();
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
    stubFetch(fetchMock);
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

  it("shows each area's week beside the day and refreshes it after a check-off", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/progress") {
        return Response.json(
          progressResponse([
            {
              area_id: "3",
              name: "SWE",
              percent: 100,
              days: [],
              requirements: [
                { ref_type: "HABIT", ref_id: "13", title: "Stretch", target: 1, done: 1 },
              ],
            },
            {
              area_id: "4",
              name: "Finance",
              percent: 17,
              days: [],
              requirements: [
                { ref_type: "GOAL", ref_id: "7", title: "CS Block", target: 3, done: 1 },
                { ref_type: "HABIT", ref_id: "12", title: "Read", target: 7, done: 0 },
              ],
            },
          ]),
        );
      }
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse();
      }
      if (request.method === "POST" && url.pathname === "/api/v1/habits/12/check") {
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
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    const panel = await screen.findByRole("complementary", { name: "This week" });
    const areas = await within(panel).findByRole("list", { name: "Areas this week" });
    expect(within(panel).getByText("1/3")).toBeInTheDocument();
    const [swe, finance] = within(areas).getAllByRole("listitem");
    expect(swe).toHaveTextContent("SWE");
    expect(swe).toHaveTextContent("1 of 1 done");
    expect(finance).toHaveTextContent("Finance");
    expect(finance).toHaveTextContent("0 of 2 done");

    await user.click(await screen.findByRole("checkbox", { name: "Read" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([request]) => new URL(request.url).pathname === "/api/v1/progress",
        ),
      ).toHaveLength(2);
    });
  });

  it("treats a habit that is already checked off as done", async () => {
    stubFetch(
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
    stubFetch(
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

  it("shows the day's tasks above the habits, sized by their blocks", async () => {
    stubFetch(
      vi.fn(async () =>
        todayResponse({
          tasks: [
            todayTask("481", "Review PR", ["09:30", "10:30"], 1, "DONE"),
            todayTask("482", "Pay bills", ["14:00", "14:15"], 0.5),
            todayTask("483", "CS Block", ["19:00", "21:00"], 2),
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const tasks = await screen.findByRole("list", { name: "Tasks" });
    const csBlock = within(tasks).getByRole("checkbox", { name: "CS Block" });
    expect(csBlock).not.toBeChecked();
    expect(csBlock).toHaveAccessibleDescription("19:00 to 21:00, 2 blocks");
    expect(within(tasks).getByRole("checkbox", { name: "Review PR" })).toBeChecked();
    expect(within(tasks).getByRole("checkbox", { name: "Pay bills" })).not.toBeChecked();
    expect(within(tasks).getAllByRole("listitem").map((item) => item.style.height)).toEqual([
      "72px",
      "32px",
      "152px",
    ]);
    expect(within(tasks).getByText("½")).toBeInTheDocument();
    expect(within(tasks).getByText("×2")).toBeInTheDocument();

    const firstHabit = screen.getByRole("checkbox", { name: "Read" });
    expect(tasks.compareDocumentPosition(firstHabit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(
      within(screen.getByRole("group", { name: "Today views" })).getByRole("button", {
        name: "Weekly",
      }),
    );
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
  });

  it("draws goal tasks and habits in their area's colour", async () => {
    stubFetch(
      vi.fn(async (request: Request) => {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/api/v1/areas") {
          return Response.json({ areas: [{ ...area("3", "Coding"), color: "GREEN" }] });
        }
        if (pathname === "/api/v1/goals") {
          return Response.json({
            goals: [
              {
                id: "7",
                area_id: "3",
                title: "CS Block",
                weekly_target: 2,
                created_at: "2026-09-22T09:00:00Z",
                rules: [],
              },
            ],
          });
        }
        return todayResponse({
          tasks: [
            todayTask("483", "CS Block", ["19:00", "21:00"], 2),
            { ...todayTask("484", "Dentist", ["08:00", "09:00"], null), goal_id: null, rule_id: null },
          ],
        });
      }),
    );
    renderPage();

    const tasks = await screen.findByRole("list", { name: "Tasks" });
    await waitFor(() => {
      expect(within(tasks).getByRole("checkbox", { name: "CS Block" }).closest("li")).toHaveClass(
        "area-green",
      );
    });
    expect(
      within(tasks).getByRole("checkbox", { name: "Dentist" }).closest("li"),
    ).not.toHaveClass("area-green");
    expect(screen.getByRole("checkbox", { name: "Read" }).closest("li")).toHaveClass("area-green");
  });

  it("completes and undoes a task", async () => {
    const pending = todayTask("483", "CS Block", ["19:00", "21:00"], 2);
    const done = todayTask("481", "Review PR", ["09:30", "10:30"], 1, "DONE");
    stubFetch(
      vi.fn(async (request: Request) => {
        const url = new URL(request.url);
        if (request.method === "GET" && url.pathname === "/api/v1/today") {
          return todayResponse({ tasks: [done, pending] });
        }
        if (request.method === "POST" && url.pathname === "/api/v1/tasks/483/check") {
          return taskResponse(pending, "DONE");
        }
        if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/481/check") {
          return taskResponse(done, "PENDING");
        }
        throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "CS Block" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "CS Block" })).toBeChecked();
    });

    await user.click(screen.getByRole("checkbox", { name: "Review PR" }));
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Review PR" })).not.toBeChecked();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("edits a task and its linked schedule with one save, then deletes the task", async () => {
    let task = todayTask("483", "CS Block", ["19:00", "20:00"], 2);
    let hasTask = true;
    let weekdays = [4];
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({ tasks: hasTask ? [task] : [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals/7") {
        return Response.json({
          id: "7",
          area_id: "3",
          title: "CS Block",
          weekly_target: 3,
          created_at: "2026-09-20T07:00:00Z",
          rules: [
            {
              id: "21",
              goal_id: "7",
              byweekday: weekdays,
              start_time: "19:00",
              duration_minutes: 60,
              block_count: 2,
            },
          ],
        });
      }
      if (request.method === "PATCH" && url.pathname === "/api/v1/tasks/483") {
        expect(await request.clone().json()).toEqual({ start_time: "20:00" });
        task = { ...task, start_time: "20:00", end_time: "21:00" };
        return Response.json({ ...task, completed_at: null });
      }
      if (request.method === "PATCH" && url.pathname === "/api/v1/rules/21") {
        expect(await request.clone().json()).toEqual({ byweekday: [4, 5] });
        weekdays = [4, 5];
        return Response.json({
          id: "21",
          goal_id: "7",
          byweekday: weekdays,
          start_time: "19:00",
          duration_minutes: 60,
          block_count: 2,
        });
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/483") {
        hasTask = false;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "CS Block" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit task" });
    fireEvent.change(within(editDialog).getByLabelText("Start time"), {
      target: { value: "20:00" },
    });
    await user.click(await within(editDialog).findByRole("button", { name: "Friday" }));
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.filter(
        ([request]) => request.method === "PATCH" && new URL(request.url).pathname === "/api/v1/tasks/483",
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(
        ([request]) => request.method === "PATCH" && new URL(request.url).pathname === "/api/v1/rules/21",
      ),
    ).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "CS Block" }));
    const deleteDialog = screen.getByRole("dialog", { name: "Edit task" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    expect(
      within(deleteDialog).getByText(/goal and any repeating schedule stay unchanged/),
    ).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete task" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "CS Block" })).not.toBeInTheDocument();
    });
  });

  it("turns on Repeat from a goal task's edit form without adding a duplicate task", async () => {
    let task = {
      ...todayTask("490", "CS Block", ["19:00", "20:00"], 2),
      rule_id: null as string | null,
      occurrence_date: null as string | null,
    };
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({ tasks: [task] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks/490/repeat") {
        expect(await request.clone().json()).toEqual({ byweekday: [4, 6] });
        task = { ...task, rule_id: "22", occurrence_date: "2026-09-24" };
        return Response.json({ ...task, completed_at: null });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "CS Block" }));
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    const repeat = within(dialog).getByRole("checkbox", { name: "Repeat" });
    expect(repeat).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(repeat);
    expect(within(dialog).getByRole("button", { name: "Thursday, task date" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(dialog).getByRole("button", { name: "Saturday" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.filter(
        ([request]) =>
          request.method === "POST" && new URL(request.url).pathname === "/api/v1/tasks/490/repeat",
      ),
    ).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([request]) => request.method === "PATCH")).toBe(false);
  });

  it("turns off Repeat from a repeating task's edit form and keeps the task", async () => {
    let task = {
      ...todayTask("483", "CS Block", ["19:00", "20:00"], 2),
      rule_id: "21" as string | null,
      occurrence_date: "2026-09-24" as string | null,
    };
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({ tasks: [task] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals/7") {
        return Response.json({
          id: "7",
          area_id: "3",
          title: "CS Block",
          weekly_target: 3,
          created_at: "2026-09-20T07:00:00Z",
          rules: [
            {
              id: "21",
              goal_id: "7",
              byweekday: [4],
              start_time: "19:00",
              duration_minutes: 60,
              block_count: 2,
            },
          ],
        });
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/tasks/483/repeat") {
        task = { ...task, rule_id: null, occurrence_date: null };
        return Response.json({ ...task, completed_at: null });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "CS Block" }));
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(await within(dialog).findByRole("button", { name: "Thursday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(dialog).getByRole("checkbox", { name: "Repeat" }));
    expect(within(dialog).getByText(/Saving ends this schedule/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.filter(
        ([request]) =>
          request.method === "DELETE" &&
          new URL(request.url).pathname === "/api/v1/tasks/483/repeat",
      ),
    ).toHaveLength(1);
    expect(screen.getByRole("button", { name: "CS Block" })).toBeInTheDocument();
  });

  it("keeps a task open and explains why when completing it fails", async () => {
    stubFetch(
      vi.fn(async (request: Request) =>
        request.method === "POST"
          ? Response.json({ code: "not_found", message: "Not found" }, { status: 404 })
          : todayResponse({ tasks: [todayTask("483", "CS Block", ["19:00", "21:00"], 2)] }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "CS Block" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This task no longer exists.");
    expect(screen.getByRole("checkbox", { name: "CS Block" })).not.toBeChecked();
  });

  it("adds a repeating goal task without creating a duplicate ad-hoc task", async () => {
    let hasTask = false;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({
          tasks: hasTask ? [todayTask("490", "CS Block", ["19:00", "20:00"], 2)] : [],
        });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        expect(url.searchParams.has("include_archived")).toBe(false);
        return Response.json({ areas: [area("3", "SWE"), area("4", "Finance")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        expect(url.searchParams.has("area_id")).toBe(false);
        return Response.json({
          goals: [
            {
              id: "7",
              area_id: "4",
              title: "CS Block",
              weekly_target: null,
              created_at: "2026-09-24T07:00:00Z",
              rules: [],
            },
          ],
        });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/goals/7/rules") {
        const body = await request.clone().json();
        expect(body).toEqual({
          byweekday: [4, 6],
          start_time: "19:00",
          duration_minutes: 60,
          block_count: 2,
        });
        hasTask = true;
        return Response.json({ id: "21", goal_id: "7", ...body }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add goal task" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeDisabled();
    const goalSelect = within(dialog).getByLabelText("Goal");
    await within(goalSelect).findByRole("option", { name: "Finance - CS Block" });
    expect(within(dialog).queryByLabelText("Area")).not.toBeInTheDocument();
    expect(within(goalSelect).queryByRole("option", { name: "No goal" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Title")).not.toBeInTheDocument();
    expect(goalSelect).toHaveValue("");
    await user.selectOptions(goalSelect, "7");
    fireEvent.change(within(dialog).getByLabelText("Start time"), {
      target: { value: "19:00" },
    });
    await user.selectOptions(within(dialog).getByLabelText("Duration"), "60");
    await user.click(within(dialog).getByRole("radio", { name: "2 blocks" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Repeat" }));
    expect(within(dialog).getByRole("button", { name: "Thursday, task date" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(dialog).getByRole("button", { name: "Saturday" }));
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    const task = await screen.findByRole("checkbox", { name: "CS Block" });
    expect(task).not.toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([request]) => request.method === "POST" && new URL(request.url).pathname === "/api/v1/tasks",
      ),
    ).toHaveLength(0);
  });

  it("adds a Journal task for today from its title, without a goal or schedule values", async () => {
    let hasTask = false;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({ tasks: hasTask ? [journalTask("491", "Dentist")] : [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/journal") {
        return Response.json({ today: "2026-09-24", active: [], completed: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
        expect(await request.clone().json()).toEqual({
          title: "Dentist",
          scheduled_date: "2026-09-24",
          start_time: null,
          duration_minutes: null,
          block_count: null,
        });
        hasTask = true;
        return Response.json(
          {
            id: "491",
            goal_id: null,
            rule_id: null,
            parent_id: null,
            title: "Dentist",
            occurrence_date: null,
            scheduled_date: "2026-09-24",
            due_date: null,
            start_time: null,
            duration_minutes: null,
            end_time: null,
            block_count: null,
            period_start: "2026-09-21",
            status: "PENDING",
            completed_at: null,
          },
          { status: 201 },
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add Journal task" }));
    const dialog = screen.getByRole("dialog", { name: "Journal task" });
    expect(within(dialog).getByLabelText("Date")).toHaveValue("2026-09-24");
    expect(within(dialog).getByLabelText("Date")).toBeDisabled();
    await within(dialog).findByText("Nothing open in the Journal.");
    await user.click(within(dialog).getByRole("button", { name: "New task" }));
    await user.type(within(dialog).getByRole("textbox", { name: "New task title" }), "Dentist{Enter}");

    expect(await screen.findByRole("checkbox", { name: "Dentist" })).not.toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a planned step as its own card with its item and progress", async () => {
    stubFetch(
      vi.fn(async () =>
        todayResponse({
          tasks: [
            todayTask("483", "CS Block", ["09:00", "10:00"], 1),
            journalTask("492", "Prepare the slides", {
              start_time: "10:30",
              block_count: 1,
              parent_id: "490",
              parent: { id: "490", title: "Conference", step_progress: { done: 1, total: 3 } },
            }),
          ],
        }),
      ),
    );
    renderPage();

    const tasks = await screen.findByRole("list", { name: "Tasks" });
    expect(within(tasks).getAllByRole("listitem")).toHaveLength(2);
    expect(within(tasks).getByRole("checkbox", { name: "Prepare the slides" })).toHaveAccessibleDescription(
      "Starts at 10:30, 1 block, a step of Conference, 1 of 3 steps done",
    );
    expect(within(tasks).getByText("Conference · 1/3")).toBeInTheDocument();
  });

  it("asks before finishing an item with open steps, then reads the day again", async () => {
    let finished = false;
    const item = journalTask("490", "Conference", { step_progress: { done: 1, total: 3 } });
    const step = journalTask("492", "Prepare the slides", {
      parent_id: "490",
      parent: { id: "490", title: "Conference", step_progress: { done: 1, total: 3 } },
    });
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({ tasks: finished ? [{ ...item, status: "DONE" }] : [item, step] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks/490/check") {
        finished = true;
        return Response.json({ ...item, status: "DONE", completed_at: "2026-09-24T09:00:00Z" });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    stubFetch(fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Conference" }));
    const dialog = screen.getByRole("dialog", { name: "Conference" });
    expect(dialog).toHaveTextContent("2 steps are not complete. Finish anyway?");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("checkbox", { name: "Conference" })).not.toBeChecked();
    expect(fetchMock.mock.calls.some(([request]) => request.method === "POST")).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "Conference" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Conference" })).getByRole("button", {
        name: "Finish anyway",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "Prepare the slides" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("checkbox", { name: "Conference" })).toBeChecked();
  });

  it("points to areas when there are no habits yet", async () => {
    stubFetch(
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
    stubFetch(
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
