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
    expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();

    const views = screen.getByRole("group", { name: "Today views" });
    expect(within(views).getByRole("button", { name: "Daily" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(views).getByRole("button", { name: "Weekly" }));

    expect(screen.getByText("Sep 21 – 27")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Call home" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add task/ })).not.toBeInTheDocument();
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

  it("shows the day's tasks above the habits, sized by their blocks", async () => {
    vi.stubGlobal(
      "fetch",
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

    const addGoal = screen.getByRole("button", { name: "Add task" });
    const firstHabit = screen.getByRole("checkbox", { name: "Read" });
    expect(tasks.compareDocumentPosition(addGoal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addGoal.compareDocumentPosition(firstHabit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(
      within(screen.getByRole("group", { name: "Today views" })).getByRole("button", {
        name: "Weekly",
      }),
    );
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
  });

  it("completes and undoes a task", async () => {
    const pending = todayTask("483", "CS Block", ["19:00", "21:00"], 2);
    const done = todayTask("481", "Review PR", ["09:30", "10:30"], 1, "DONE");
    vi.stubGlobal(
      "fetch",
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
    vi.stubGlobal("fetch", fetchMock);
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

  it("keeps a task open and explains why when completing it fails", async () => {
    vi.stubGlobal(
      "fetch",
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
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    const goalSelect = within(dialog).getByLabelText("Goal");
    await within(goalSelect).findByRole("option", { name: "Finance - CS Block" });
    expect(within(dialog).queryByLabelText("Area")).not.toBeInTheDocument();
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

  it("adds a standalone task without requiring schedule values", async () => {
    let hasTask = false;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/today") {
        return todayResponse({
          tasks: hasTask
            ? [
                {
                  ...todayTask("491", "Dentist", [null, null], null),
                  goal_id: null,
                  rule_id: null,
                  duration_minutes: null,
                  occurrence_date: null,
                },
              ]
            : [],
        });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("3", "SWE")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        expect(url.searchParams.has("area_id")).toBe(false);
        return Response.json({ goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
        expect(await request.clone().json()).toEqual({
          goal_id: null,
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
            title: "Dentist",
            occurrence_date: null,
            scheduled_date: "2026-09-24",
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
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    const goalSelect = within(dialog).getByLabelText("Goal");
    await waitFor(() => expect(goalSelect).toBeEnabled());
    expect(within(goalSelect).getAllByRole("option")).toHaveLength(1);
    expect(within(goalSelect).getByRole("option", { name: "No goal" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Add a goal in Areas")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Title"), "Dentist");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("checkbox", { name: "Dentist" })).not.toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
