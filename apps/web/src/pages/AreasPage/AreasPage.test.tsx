import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AreasPage } from "./AreasPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));
const createdAt = "2026-09-22T09:00:00Z";

function area(id: string, name: string) {
  return {
    id,
    name,
    archived_at: null,
    unarchived_at: null,
    created_at: createdAt,
  };
}

function habit(id: string, title: string, mode: "DAILY" | "WEEKLY") {
  return { id, area_id: "1", title, mode, created_at: createdAt };
}

function goal(id: string, title: string, weeklyTarget: number | null, rules: unknown[] = []) {
  return { id, area_id: "1", title, weekly_target: weeklyTarget, created_at: createdAt, rules };
}

function rule(
  id: string,
  byweekday: number[],
  startTime: string,
  durationMinutes = 60,
  blockCount = 1,
) {
  return {
    id,
    goal_id: "7",
    byweekday,
    start_time: startTime,
    duration_minutes: durationMinutes,
    block_count: blockCount,
  };
}

function requestsTo(fetchMock: ReturnType<typeof vi.fn>, method: string, pathname: string) {
  return fetchMock.mock.calls
    .map(([request]) => request as Request)
    .filter(
      (request) => request.method === method && new URL(request.url).pathname === pathname,
    );
}

function respondWithAreas(areas: unknown[]) {
  return vi.fn(async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/v1/habits") {
      return Response.json({ habits: [] });
    }
    if (pathname === "/api/v1/goals") {
      return Response.json({ goals: [] });
    }
    return Response.json({ areas });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/areas"]}>
      <AreasPage onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("Areas page", () => {
  beforeEach(() => {
    onLogout.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ areas: [] })),
    );
  });

  it("renders domain selection, page navigation, and area management in main", async () => {
    renderPage();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Spoons Up")).toBeInTheDocument();
    const domainSelect = screen.getByRole("combobox", { name: "Domain" });
    expect(domainSelect).toHaveValue("goals-and-habits");
    expect(
      screen.getByRole("option", { name: "Nutrition — Coming soon" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Fitness — Coming soon" }),
    ).toBeDisabled();

    const sidebar = screen.getByRole("complementary", { name: "Page navigation" });
    expect(within(sidebar).getByRole("link", { name: "Areas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/today",
    );
    expect(within(sidebar).getByRole("button", { name: /Week/ })).toBeDisabled();
    expect(within(sidebar).queryByRole("button", { name: "Add area" })).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Create your first area" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("button", { name: "Add area" }),
    ).toBeInTheDocument();
  });

  it("loads, selects, creates, and renames areas", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (request.method === "GET" && pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE"), area("2", "Finance")] });
      }
      if (request.method === "POST" && pathname === "/api/v1/areas") {
        expect(await request.clone().json()).toEqual({ name: "Social" });
        return Response.json(area("3", "Social"), { status: 201 });
      }
      if (request.method === "PATCH" && pathname === "/api/v1/areas/3") {
        expect(await request.clone().json()).toEqual({ name: "Community" });
        return Response.json(area("3", "Community"));
      }
      if (request.method === "GET" && pathname === "/api/v1/habits") {
        return Response.json({ habits: [] });
      }
      if (request.method === "GET" && pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      throw new Error(`Unexpected request: ${request.method} ${pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "SWE" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finance" }));
    expect(screen.getByRole("heading", { name: "Finance" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add area" }));
    await user.type(screen.getByLabelText("Area name"), "Social");
    await user.click(screen.getByRole("button", { name: "Create area" }));
    expect(await screen.findByRole("heading", { name: "Social" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByLabelText("Area name");
    await user.clear(renameInput);
    await user.type(renameInput, "Community");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Community" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Community" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const areaRequests = fetchMock.mock.calls.filter(([request]) =>
      new URL(request.url).pathname.startsWith("/api/v1/areas"),
    );
    expect(areaRequests).toHaveLength(3);
  });

  it("archives, restores, and permanently deletes an archived area", async () => {
    const archivedAt = "2026-09-23T09:00:00Z";
    const unarchivedAt = "2026-09-23T10:00:00Z";
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (request.method === "GET" && pathname === "/api/v1/areas") {
        expect(new URL(request.url).searchParams.get("include_archived")).toBe("true");
        return Response.json({
          areas: [
            { ...area("2", "Old project"), archived_at: archivedAt },
            area("1", "SWE"),
          ],
        });
      }
      if (request.method === "POST" && pathname === "/api/v1/areas/1/archive") {
        const body = await request.clone().json();
        return body.archived
          ? Response.json({ ...area("1", "SWE"), archived_at: archivedAt })
          : Response.json({ ...area("1", "SWE"), unarchived_at: unarchivedAt });
      }
      if (request.method === "DELETE" && pathname === "/api/v1/areas/2") {
        return new Response(null, { status: 204 });
      }
      if (request.method === "GET" && pathname === "/api/v1/habits") {
        return Response.json({ habits: [] });
      }
      if (request.method === "GET" && pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      throw new Error(`Unexpected request: ${request.method} ${pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "SWE" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByText("Restore this area to make it active again, or delete it permanently."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore" }));
    await user.click(await screen.findByRole("button", { name: "Area actions" }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archived 1" }));
    await user.click(screen.getByRole("button", { name: "Old project (archived)" }));
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(screen.getByText("Delete Old project permanently?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Old project (archived)" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "No archived areas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByRole("heading", { name: "SWE" })).toBeInTheDocument();
  });

  it("shows active and archived areas in separate views", async () => {
    vi.stubGlobal(
      "fetch",
      respondWithAreas([
        area("1", "SWE"),
        { ...area("2", "Old project"), archived_at: "2026-09-23T09:00:00Z" },
      ]),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "SWE" })).toBeInTheDocument();
    const views = screen.getByRole("group", { name: "Area views" });
    expect(within(views).getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(views).getByRole("button", { name: /History/ })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Old project (archived)" }),
    ).not.toBeInTheDocument();

    await user.click(within(views).getByRole("button", { name: "Archived 1" }));
    expect(screen.getByRole("heading", { name: "Old project" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Old project (archived)" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "SWE" })).not.toBeInTheDocument();

    await user.click(within(views).getByRole("button", { name: "Active" }));
    expect(screen.getByRole("heading", { name: "SWE" })).toBeInTheDocument();
  });

  it("allows empty views and opens area creation in the active view", async () => {
    vi.stubGlobal(
      "fetch",
      respondWithAreas([
        { ...area("2", "Old project"), archived_at: "2026-09-23T09:00:00Z" },
      ]),
    );
    const user = userEvent.setup();
    renderPage();

    const views = screen.getByRole("group", { name: "Area views" });
    const activeView = within(views).getByRole("button", { name: "Active" });

    expect(await screen.findByText("No active areas.")).toBeInTheDocument();
    const archivedView = within(views).getByRole("button", { name: "Archived 1" });
    expect(activeView).toHaveAttribute("aria-pressed", "true");
    expect(archivedView).toBeEnabled();

    await user.click(archivedView);
    expect(screen.getByRole("heading", { name: "Old project" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add area" }));
    expect(activeView).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Area name")).toBeInTheDocument();
    expect(screen.getByText("No active areas.")).toBeInTheDocument();
  });

  it("opens area actions and closes them with Escape or an outside click", async () => {
    vi.stubGlobal("fetch", respondWithAreas([area("1", "SWE")]));
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "SWE" });
    const menuButton = screen.getByRole("button", { name: "Area actions" });
    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const menu = document.getElementById(menuButton.getAttribute("aria-controls") ?? "");
    expect(menu).not.toBeNull();
    expect(within(menu!).getByRole("button", { name: "Rename" })).toBeEnabled();
    expect(within(menu!).getByRole("button", { name: "Archive" })).toBeEnabled();
    expect(within(menu!).getByRole("button", { name: "Delete area" })).toBeEnabled();
    expect(within(menu!).queryByRole("button", { name: /Add/ })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();

    await user.click(menuButton);
    await user.click(screen.getByRole("heading", { name: "Areas" }));
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("adds, edits, and deletes habits from the area panel", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/habits") {
        expect(url.searchParams.get("area_id")).toBe("1");
        return Response.json({ habits: [habit("10", "Read", "DAILY")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/habits") {
        expect(await request.clone().json()).toEqual({
          area_id: "1",
          title: "Stretch",
          mode: "WEEKLY",
        });
        return Response.json(habit("11", "Stretch", "WEEKLY"), { status: 201 });
      }
      if (request.method === "PATCH" && url.pathname === "/api/v1/habits/11") {
        expect(await request.clone().json()).toEqual({
          title: "Stretch 10 min",
          mode: "DAILY",
        });
        return Response.json(habit("11", "Stretch 10 min", "DAILY"));
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/habits/11") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Read, daily habit" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add goal" })).toBeEnabled();

    const addHabit = screen.getByRole("button", { name: "Add habit" });
    await user.click(addHabit);
    expect(screen.getByRole("dialog", { name: "New habit" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addHabit).toHaveFocus();

    await user.click(addHabit);
    const createDialog = screen.getByRole("dialog", { name: "New habit" });
    expect(within(createDialog).getByLabelText("Title")).toHaveFocus();
    expect(within(createDialog).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(within(createDialog).getByLabelText("Title"), "Stretch");
    await user.click(within(createDialog).getByRole("radio", { name: "Weekly" }));
    await user.click(within(createDialog).getByRole("button", { name: "Add" }));

    expect(
      await screen.findByRole("button", { name: "Stretch, weekly habit" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stretch, weekly habit" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit habit" });
    const titleInput = within(editDialog).getByLabelText("Title");
    expect(titleInput).toHaveValue("Stretch");
    await user.clear(titleInput);
    await user.type(titleInput, "Stretch 10 min");
    await user.click(within(editDialog).getByRole("radio", { name: "Daily" }));
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    const editedHabit = await screen.findByRole("button", {
      name: "Stretch 10 min, daily habit",
    });
    await user.click(editedHabit);
    const deleteDialog = screen.getByRole("dialog", { name: "Edit habit" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    expect(within(deleteDialog).getByText("Delete “Stretch 10 min”?")).toBeInTheDocument();
    expect(
      within(deleteDialog).getByText(/check-offs are deleted with it/),
    ).toBeInTheDocument();
    await user.click(
      within(deleteDialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Stretch 10 min, daily habit" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read, daily habit" })).toBeInTheDocument();
  });

  it("deletes an active area after warning that its history goes with it", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE"), area("2", "Finance")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/habits") {
        return Response.json({
          habits:
            url.searchParams.get("area_id") === "1"
              ? [habit("10", "Read", "DAILY"), habit("11", "Walk", "DAILY")]
              : [],
        });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/areas/1") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Read, daily habit" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(screen.getByRole("button", { name: "Delete area" }));

    const confirmation = screen.getByRole("group", { name: "Confirm area deletion" });
    expect(within(confirmation).getByText("Delete “SWE”?")).toBeInTheDocument();
    expect(within(confirmation).getByText("The area")).toBeInTheDocument();
    expect(
      within(confirmation).getByText("2 habits and their check-off history"),
    ).toBeInTheDocument();
    expect(within(confirmation).getByText(/Archive it instead/)).toBeInTheDocument();
    expect(within(confirmation).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(confirmation).getByRole("button", { name: "Delete area" }));

    expect(await screen.findByRole("heading", { name: "Finance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SWE" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Confirm area deletion" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Area actions" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const deleteRequests = fetchMock.mock.calls.filter(
      ([request]) => request.method === "DELETE",
    );
    expect(deleteRequests).toHaveLength(1);
  });

  it("adds a goal with its rules from the area panel", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/habits") {
        return Response.json({ habits: [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        expect(url.searchParams.get("area_id")).toBe("1");
        return Response.json({ goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/goals") {
        expect(await request.clone().json()).toEqual({
          area_id: "1",
          title: "CS Block",
          weekly_target: 3,
        });
        return Response.json(goal("7", "CS Block", 3), { status: 201 });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/goals/7/rules") {
        const body = await request.clone().json();
        return Response.json(
          { id: body.byweekday[0] === 1 ? "21" : "22", goal_id: "7", ...body },
          { status: 201 },
        );
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    const dialog = screen.getByRole("dialog", { name: "New goal" });
    expect(within(dialog).getByText("SWE")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Area")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Title")).toHaveFocus();
    await user.type(within(dialog).getByLabelText("Title"), "CS Block");
    const increaseTarget = within(dialog).getByRole("button", { name: "Increase weekly target" });
    await user.click(increaseTarget);
    await user.click(increaseTarget);
    await user.click(increaseTarget);
    expect(within(dialog).getByLabelText("Weekly target")).toHaveValue("3");

    await user.click(within(dialog).getByRole("checkbox", { name: "Repeat" }));
    // A schedule needs a day before the goal can be saved.
    const firstRule = within(dialog).getByRole("group", { name: "Schedule 1" });
    expect(within(firstRule).getByText("No days selected · 09:00–10:00")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
    for (const day of ["Monday", "Wednesday", "Friday"]) {
      await user.click(within(firstRule).getByRole("button", { name: day }));
    }
    fireEvent.change(within(firstRule).getByLabelText("Start time"), {
      target: { value: "19:00" },
    });
    await user.selectOptions(within(firstRule).getByLabelText("Duration"), "90");
    await user.click(within(firstRule).getByRole("radio", { name: "2 blocks" }));
    expect(within(firstRule).getByText("Mon, Wed, Fri · 19:00–20:30")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Add schedule" }));
    const secondRule = within(dialog).getByRole("group", { name: "Schedule 2" });
    await user.click(within(secondRule).getByRole("button", { name: "Saturday" }));
    await user.click(within(secondRule).getByRole("radio", { name: "Half a block" }));
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("button", { name: "CS Block, goal" })).toBeInTheDocument();
    expect(screen.getByText("3 blocks/week")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const ruleBodies = await Promise.all(
      requestsTo(fetchMock, "POST", "/api/v1/goals/7/rules").map((request) =>
        request.clone().json(),
      ),
    );
    expect(ruleBodies).toEqual([
      { byweekday: [1, 3, 5], start_time: "19:00", duration_minutes: 90, block_count: 2 },
      { byweekday: [6], start_time: "09:00", duration_minutes: 60, block_count: 0.5 },
    ]);
  });

  it("saves only what changed in a goal and deletes it", async () => {
    const savedGoal = goal("7", "CS Block", 3, [
      rule("21", [1, 3, 5], "19:00"),
      rule("22", [6], "10:00"),
    ]);
    const writes: string[] = [];
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/habits") {
        return Response.json({ habits: [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [savedGoal] });
      }
      writes.push(`${request.method} ${url.pathname}`);
      if (request.method === "PATCH" && url.pathname === "/api/v1/goals/7") {
        expect(await request.clone().json()).toEqual({ weekly_target: null });
        return Response.json({ ...savedGoal, weekly_target: null });
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/rules/21") {
        return new Response(null, { status: 204 });
      }
      if (request.method === "PATCH" && url.pathname === "/api/v1/rules/22") {
        expect(await request.clone().json()).toEqual({ block_count: 2 });
        return Response.json(rule("22", [6], "10:00", 60, 2));
      }
      if (request.method === "DELETE" && url.pathname === "/api/v1/goals/7") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "CS Block, goal" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit goal" });
    expect(within(editDialog).getByLabelText("Title")).toHaveValue("CS Block");
    expect(within(editDialog).getByLabelText("Weekly target")).toHaveValue("3");
    await user.clear(within(editDialog).getByLabelText("Weekly target"));
    await user.click(within(editDialog).getByRole("button", { name: "Remove schedule 1" }));
    const remainingRule = within(editDialog).getByRole("group", { name: "Schedule 1" });
    expect(within(remainingRule).getByText("Sat · 10:00–11:00")).toBeInTheDocument();
    await user.click(within(remainingRule).getByRole("radio", { name: "2 blocks" }));
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("No target")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An unchanged title or rule is not sent, since a rule write redraws its pending tasks.
    expect(writes).toEqual([
      "PATCH /api/v1/goals/7",
      "DELETE /api/v1/rules/21",
      "PATCH /api/v1/rules/22",
    ]);

    await user.click(screen.getByRole("button", { name: "CS Block, goal" }));
    const deleteDialog = screen.getByRole("dialog", { name: "Edit goal" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    expect(within(deleteDialog).getByText("Delete “CS Block”?")).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "CS Block, goal" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
    expect(writes.at(-1)).toBe("DELETE /api/v1/goals/7");
  });

  it("keeps a new goal when a rule fails and retries only the rule", async () => {
    let ruleAttempts = 0;
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE")] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/habits") {
        return Response.json({ habits: [] });
      }
      if (request.method === "GET" && url.pathname === "/api/v1/goals") {
        return Response.json({ goals: [] });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/goals") {
        return Response.json(goal("7", "Read papers", null), { status: 201 });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/goals/7/rules") {
        ruleAttempts += 1;
        if (ruleAttempts === 1) {
          throw new TypeError("Network unavailable");
        }
        return Response.json(rule("21", [2], "09:00"), { status: 201 });
      }
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add goal" }));
    const dialog = screen.getByRole("dialog", { name: "New goal" });
    await user.type(within(dialog).getByLabelText("Title"), "Read papers");
    await user.click(within(dialog).getByRole("checkbox", { name: "Repeat" }));
    const firstRule = within(dialog).getByRole("group", { name: "Schedule 1" });
    await user.click(within(firstRule).getByRole("button", { name: "Tuesday" }));
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "We couldn't reach Spoons Up.",
    );
    expect(within(dialog).getByRole("heading", { name: "Edit goal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read papers, goal" })).toBeInTheDocument();
    expect(screen.getByText("No target")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("No target")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "POST", "/api/v1/goals")).toHaveLength(1);
    expect(ruleAttempts).toBe(2);
  });

  it("lists goals above habits and names them in the delete warning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/api/v1/habits") {
          return Response.json({ habits: [habit("10", "Read", "DAILY")] });
        }
        if (pathname === "/api/v1/goals") {
          return Response.json({ goals: [goal("7", "CS Block", 3), goal("8", "Ship v1", null)] });
        }
        return Response.json({ areas: [area("1", "SWE")] });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const goals = await screen.findByRole("list", { name: "Goals" });
    const habits = screen.getByRole("list", { name: "Habits" });
    expect(goals.compareDocumentPosition(habits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(goals).getByText("3 blocks/week")).toBeInTheDocument();
    expect(within(goals).getByText("No target")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(screen.getByRole("button", { name: "Delete area" }));
    const confirmation = screen.getByRole("group", { name: "Confirm area deletion" });
    expect(within(confirmation).getByText("2 goals and their history")).toBeInTheDocument();
    expect(
      within(confirmation).getByText("1 habit and its check-off history"),
    ).toBeInTheDocument();
  });

  it("opens and closes the narrow-screen navigation drawer with focus management", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Create your first area" });
    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });

    await user.click(menuButton);

    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    expect(drawer).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Navigation" }),
      ).not.toBeInTheDocument();
    });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveFocus();
  });
});
