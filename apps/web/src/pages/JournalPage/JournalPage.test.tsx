import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JournalPage } from "./JournalPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));

type FakeTask = {
  id: string;
  parentId: string | null;
  title: string;
  dueDate: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  startTime: string | null;
  status: "PENDING" | "DONE";
  completedAt: string | null;
  createdAt: string;
};

function task(id: string, title: string, fields: Partial<FakeTask> = {}): FakeTask {
  return {
    id,
    parentId: null,
    title,
    dueDate: null,
    priority: null,
    startTime: null,
    status: "PENDING",
    completedAt: null,
    createdAt: "2026-09-01T09:00:00Z",
    ...fields,
  };
}

function doneTask(id: string, title: string, fields: Partial<FakeTask> = {}) {
  return task(id, title, { status: "DONE", completedAt: "2026-09-23T12:00:00Z", ...fields });
}

// A small stand-in for the API that keeps its tasks between requests. Items are listed in the
// order they were added, which the page must keep.
function fakeApi(initial: FakeTask[]) {
  const tasks = [...initial];
  let nextId = 900;
  let completions = 0;

  const stepBody = (step: FakeTask) => ({
    id: step.id,
    parent_id: step.parentId,
    title: step.title,
    scheduled_date: null,
    start_time: null,
    duration_minutes: null,
    end_time: null,
    block_count: null,
    status: step.status,
    completed_at: step.completedAt,
  });
  const itemBody = (item: FakeTask) => {
    const steps = tasks.filter((step) => step.parentId === item.id);
    return {
      id: item.id,
      title: item.title,
      due_date: item.dueDate,
      priority: item.priority,
      scheduled_date: item.dueDate,
      start_time: item.startTime,
      duration_minutes: null,
      end_time: null,
      block_count: null,
      status: item.status,
      completed_at: item.completedAt,
      created_at: item.createdAt,
      progress: {
        done: steps.filter((step) => step.status === "DONE").length,
        total: steps.length,
      },
      steps: steps.map(stepBody),
    };
  };
  const taskBody = (row: FakeTask) => ({
    id: row.id,
    goal_id: null,
    rule_id: null,
    parent_id: row.parentId,
    title: row.title,
    occurrence_date: null,
    scheduled_date: row.dueDate,
    due_date: row.dueDate,
    priority: row.priority,
    start_time: row.startTime,
    duration_minutes: null,
    end_time: null,
    block_count: null,
    period_start: row.dueDate ? "2026-09-21" : null,
    status: row.status,
    completed_at: row.completedAt,
  });

  return vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/v1/journal") {
      const items = tasks.filter((row) => row.parentId === null);
      return Response.json({
        today: "2026-09-24",
        active: items.filter((row) => row.status === "PENDING").map(itemBody),
        completed: items
          .filter((row) => row.status === "DONE")
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
          .map(itemBody),
      });
    }
    if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
      const body = await request.clone().json();
      const row = task(String(nextId++), body.title, {
        parentId: body.parent_id ?? null,
        dueDate: body.due_date ?? null,
        priority: body.priority ?? null,
        startTime: body.start_time ?? null,
      });
      tasks.push(row);
      return Response.json(taskBody(row), { status: 201 });
    }

    const [, id, check] = /^\/api\/v1\/tasks\/(\d+)(\/check)?$/.exec(url.pathname) ?? [];
    const row = tasks.find((item) => item.id === id);
    if (row && check && request.method === "POST") {
      row.status = "DONE";
      row.completedAt = `2026-09-24T${10 + completions++}:00:00Z`;
      return Response.json(taskBody(row));
    }
    if (row && check && request.method === "DELETE") {
      row.status = "PENDING";
      row.completedAt = null;
      return Response.json(taskBody(row));
    }
    if (row && request.method === "PATCH") {
      const body = await request.clone().json();
      if ("title" in body) {
        row.title = body.title;
      }
      if ("due_date" in body) {
        row.dueDate = body.due_date;
        if (body.due_date === null) {
          row.startTime = null;
        }
      }
      if ("start_time" in body) {
        row.startTime = body.start_time;
      }
      if ("priority" in body) {
        row.priority = body.priority;
      }
      return Response.json(taskBody(row));
    }
    if (row && request.method === "DELETE") {
      tasks.splice(
        0,
        tasks.length,
        ...tasks.filter((item) => item.id !== row.id && item.parentId !== row.id),
      );
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  });
}

function requestsTo(api: ReturnType<typeof fakeApi>, method: string, pathname: string) {
  return api.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === method && new URL(request.url).pathname === pathname);
}

function bodiesOf(requests: Request[]) {
  return Promise.all(requests.map((request) => request.clone().json()));
}

function expectInOrder(elements: HTMLElement[]) {
  elements.slice(1).forEach((element, index) => {
    expect(
      elements[index]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/journal"]}>
      <JournalPage onLogout={onLogout} />
    </MemoryRouter>,
  );
}

async function openNewItem(user: ReturnType<typeof userEvent.setup>) {
  const newItem = screen.getByRole("button", { name: "New item" });
  await waitFor(() => expect(newItem).toBeEnabled());
  await user.click(newItem);
  return screen.getByRole("dialog", { name: "New item" });
}

describe("Journal page", () => {
  beforeEach(() => {
    onLogout.mockClear();
  });

  it("lists items in the order the API returns them, with due dates, times and step progress", async () => {
    vi.stubGlobal(
      "fetch",
      fakeApi([
        task("480", "Renew the lease", { dueDate: "2026-09-18" }),
        task("481", "Pay the invoice", { dueDate: "2026-09-24", startTime: "14:00" }),
        task("482", "Conference", { dueDate: "2026-10-02", startTime: "10:00" }),
        doneTask("483", "Recall the project", { parentId: "482" }),
        doneTask("484", "Prepare the slides", { parentId: "482" }),
        task("485", "Go over it", { parentId: "482" }),
        task("486", "Final run", { parentId: "482" }),
        task("487", "Return the parcel"),
        doneTask("488", "Pick up the parcel"),
      ]),
    );
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading journal…");
    const active = await screen.findByRole("list", { name: "Active items" });
    expectInOrder(
      ["Renew the lease", "Pay the invoice", "Conference", "Return the parcel"].map((name) =>
        within(active).getByRole("checkbox", { name }),
      ),
    );
    expect(within(active).queryByText("Go over it")).not.toBeInTheDocument();

    const lists = screen.getByRole("group", { name: "Journal lists" });
    expect(within(lists).getByRole("button", { name: "Active 4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(lists).getByRole("button", { name: "Completed 1" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    expect(within(active).getByRole("button", { name: "Renew the lease" })).toHaveAccessibleDescription(
      "Due Fri, Sep 18, overdue",
    );
    expect(within(active).getByText("Fri, Sep 18")).toHaveClass("text-danger");
    expect(within(active).getByRole("button", { name: "Pay the invoice" })).toHaveAccessibleDescription(
      "Due today at 14:00",
    );
    expect(within(active).getByText("Today · 14:00")).not.toHaveClass("text-danger");
    expect(within(active).getByRole("button", { name: "Conference" })).toHaveAccessibleDescription(
      "Due Fri, Oct 2 at 10:00, 2 of 4 steps done",
    );
    expect(within(active).getByText("2/4")).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Return the parcel" })).toHaveAccessibleDescription(
      "No due date",
    );

    const sidebar = screen.getByRole("complementary", { name: "Page navigation" });
    expect(within(sidebar).getByRole("link", { name: "Journal" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(within(lists).getByRole("button", { name: "Completed 1" }));
    const completed = screen.getByRole("list", { name: "Completed items" });
    expect(within(completed).getByRole("checkbox", { name: "Pick up the parcel" })).toBeChecked();
    expect(
      within(completed).getByRole("button", { name: "Pick up the parcel" }),
    ).toHaveAccessibleDescription("Completed Sep 23");
    expect(within(completed).getByText("Sep 23")).toBeInTheDocument();
  });

  it("shows an empty state for each list", async () => {
    vi.stubGlobal("fetch", fakeApi([]));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("No open items.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Completed 0" }));
    expect(screen.getByText("Nothing completed yet.")).toBeInTheDocument();
  });

  it("explains why the journal could not be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network unavailable");
      }),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't reach Spoons Up.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New item" })).toBeDisabled();
  });

  it("shows the API's message when the journal read fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ code: "internal_error", message: "Something went wrong" }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("adds an item with a due date, a time and steps typed one after another", async () => {
    const api = fakeApi([]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open items.");
    const dialog = await openNewItem(user);
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    expect(title).toHaveFocus();
    expect(within(dialog).getByLabelText("Time")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();

    await user.type(title, "Conference");
    fireEvent.change(within(dialog).getByLabelText("Due date"), {
      target: { value: "2026-10-02" },
    });
    const time = within(dialog).getByLabelText("Time");
    expect(time).toBeEnabled();
    fireEvent.change(time, { target: { value: "10:00" } });

    const stepEntry = within(dialog).getByRole("textbox", { name: "Add step" });
    await user.type(stepEntry, "Prepare the slides{Enter}");
    expect(stepEntry).toHaveValue("");
    expect(stepEntry).toHaveFocus();
    await user.type(stepEntry, "Rehearse{Enter}");
    const steps = within(dialog).getByRole("list", { name: "Steps" });
    expect(within(steps).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Prepare the slides",
      "Rehearse",
    ]);
    expect(requestsTo(api, "POST", "/api/v1/tasks")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await bodiesOf(requestsTo(api, "POST", "/api/v1/tasks"))).toEqual([
      { title: "Conference", due_date: "2026-10-02", start_time: "10:00" },
      { parent_id: "900", title: "Prepare the slides" },
      { parent_id: "900", title: "Rehearse" },
    ]);
    const active = await screen.findByRole("list", { name: "Active items" });
    expect(within(active).getByRole("button", { name: "Conference" })).toHaveAccessibleDescription(
      "Due Fri, Oct 2 at 10:00, 0 of 2 steps done",
    );
    expect(screen.getByRole("button", { name: "New item" })).toHaveFocus();
  });

  it("keeps a new item when a step fails and saves the step on retry", async () => {
    const api = fakeApi([]);
    let creates = 0;
    vi.stubGlobal("fetch", async (request: Request) => {
      if (request.method === "POST" && new URL(request.url).pathname === "/api/v1/tasks") {
        creates += 1;
        // The item and its first step save; the second step fails once.
        if (creates === 3) {
          throw new TypeError("Network unavailable");
        }
      }
      return api(request);
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("No open items.");
    const dialog = await openNewItem(user);
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Conference");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Add step" }),
      "Prepare the slides{Enter}Rehearse{Enter}",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    const saved = await screen.findByRole("dialog", { name: "Conference" });
    expect(within(saved).getByRole("alert")).toHaveTextContent("We couldn't reach Spoons Up.");
    expect(within(saved).getByRole("checkbox", { name: "Prepare the slides" })).not.toBeChecked();
    expect(within(saved).getByText("Not saved")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Active items" })).getByRole("button", {
        name: "Conference",
      }),
    ).toBeInTheDocument();

    await user.click(within(saved).getByRole("button", { name: "Retry unsaved steps" }));

    expect(await within(saved).findByRole("checkbox", { name: "Rehearse" })).not.toBeChecked();
    expect(within(saved).queryByText("Not saved")).not.toBeInTheDocument();
    expect(within(saved).queryByRole("alert")).not.toBeInTheDocument();
    expect(await bodiesOf(requestsTo(api, "POST", "/api/v1/tasks"))).toEqual([
      { title: "Conference" },
      { parent_id: "900", title: "Prepare the slides" },
      { parent_id: "900", title: "Rehearse" },
    ]);
  });

  it("saves title and due date changes together, then clears the due date", async () => {
    const api = fakeApi([
      task("490", "Pay the invoice", { dueDate: "2026-09-26", startTime: "14:00" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole("button", { name: "Pay the invoice" });
    await user.click(row);
    const dialog = screen.getByRole("dialog", { name: "Pay the invoice" });
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    const dueDate = within(dialog).getByLabelText("Due date");
    expect(title).toHaveFocus();
    expect(dueDate).toHaveValue("2026-09-26");
    expect(within(dialog).getByLabelText("Time")).toHaveValue("14:00");
    expect(within(dialog).getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    await user.clear(title);
    await user.type(title, "Pay the rent");
    expect(within(dialog).queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    fireEvent.change(dueDate, { target: { value: "2026-09-20" } });
    expect(within(dialog).getByText("Choose today or a later date.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(dueDate, { target: { value: "2026-09-28" } });
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(await bodiesOf(requestsTo(api, "PATCH", "/api/v1/tasks/490"))).toEqual([
      { title: "Pay the rent", due_date: "2026-09-28", start_time: "14:00" },
    ]);
    await waitFor(() => expect(title).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Pay the rent" })).toBe(dialog);

    await user.click(within(dialog).getByRole("button", { name: "Remove due date" }));
    expect(dueDate).toHaveFocus();
    expect(dueDate).toHaveValue("");
    expect(within(dialog).getByLabelText("Time")).toHaveValue("");
    expect(within(dialog).getByLabelText("Time")).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requestsTo(api, "PATCH", "/api/v1/tasks/490")).toHaveLength(2));
    expect(await requestsTo(api, "PATCH", "/api/v1/tasks/490")[1]!.clone().json()).toEqual({
      due_date: null,
    });
    expect(await within(dialog).findByRole("button", { name: "Complete" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveFocus();
    expect(row).toHaveAccessibleName("Pay the rent");
    expect(row).toHaveAccessibleDescription("No due date");
  });

  it("shows priorities as tags in their own column and sets them from the detail", async () => {
    const api = fakeApi([
      task("490", "Call the bank"),
      task("491", "Return the book", { priority: "LOW" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    const active = await screen.findByRole("list", { name: "Active items" });
    expect(within(active).getByText("Low")).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Return the book" })).toHaveAccessibleDescription(
      "Low priority, No due date",
    );
    expect(within(active).getByRole("button", { name: "Call the bank" })).toHaveAccessibleDescription(
      "No due date",
    );

    const created = await openNewItem(user);
    await user.type(within(created).getByRole("textbox", { name: "Title" }), "Pay the rent");
    expect(within(created).getByRole("radio", { name: "None" })).toBeChecked();
    await user.click(within(created).getByRole("radio", { name: "High" }));
    await user.click(within(created).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      await screen.findByRole("button", { name: "Pay the rent" }),
    ).toHaveAccessibleDescription("High priority, No due date");

    await user.click(screen.getByRole("button", { name: "Call the bank" }));
    let dialog = screen.getByRole("dialog", { name: "Call the bank" });
    await user.click(within(dialog).getByRole("radio", { name: "Medium" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await within(dialog).findByRole("button", { name: "Complete" });
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Return the book" }));
    dialog = screen.getByRole("dialog", { name: "Return the book" });
    expect(within(dialog).getByRole("radio", { name: "Low" })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: "None" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await within(dialog).findByRole("button", { name: "Complete" });

    expect(await bodiesOf(requestsTo(api, "POST", "/api/v1/tasks"))).toEqual([
      { title: "Pay the rent", priority: "HIGH" },
    ]);
    expect(await bodiesOf(requestsTo(api, "PATCH", "/api/v1/tasks/490"))).toEqual([
      { priority: "MEDIUM" },
    ]);
    expect(await bodiesOf(requestsTo(api, "PATCH", "/api/v1/tasks/491"))).toEqual([
      { priority: null },
    ]);
  });

  it("sorts active items by due date, date added or priority", async () => {
    vi.stubGlobal(
      "fetch",
      fakeApi([
        task("480", "Renew the lease", {
          dueDate: "2026-09-18",
          priority: "LOW",
          createdAt: "2026-09-10T09:00:00Z",
        }),
        task("481", "Pay the invoice", { dueDate: "2026-09-24", createdAt: "2026-09-20T09:00:00Z" }),
        task("482", "Call the bank", { priority: "HIGH", createdAt: "2026-09-01T09:00:00Z" }),
        task("483", "Return the book", { priority: "LOW", createdAt: "2026-09-15T09:00:00Z" }),
        doneTask("484", "Pick up the parcel", { priority: "LOW" }),
        doneTask("485", "Book the tickets", {
          priority: "HIGH",
          completedAt: "2026-09-22T12:00:00Z",
        }),
      ]),
    );
    const user = userEvent.setup();
    renderPage();

    const active = await screen.findByRole("list", { name: "Active items" });
    const expectRows = (list: HTMLElement, names: string[]) =>
      expectInOrder(names.map((name) => within(list).getByRole("checkbox", { name })));
    const sort = screen.getByRole("combobox", { name: "Sort by" });
    expect(sort).toHaveValue("due");
    expectRows(active, ["Renew the lease", "Pay the invoice", "Call the bank", "Return the book"]);

    await user.selectOptions(sort, "Date added");
    expectRows(active, ["Pay the invoice", "Return the book", "Renew the lease", "Call the bank"]);

    await user.selectOptions(sort, "Priority");
    expectRows(active, ["Call the bank", "Renew the lease", "Return the book", "Pay the invoice"]);

    await user.click(screen.getByRole("button", { name: "Completed 2" }));
    expect(screen.queryByRole("combobox", { name: "Sort by" })).not.toBeInTheDocument();
    expectRows(screen.getByRole("list", { name: "Completed items" }), [
      "Pick up the parcel",
      "Book the tickets",
    ]);

    await user.click(screen.getByRole("button", { name: "Active 4" }));
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("priority");
  });

  it("discards unsaved changes to the fields", async () => {
    const api = fakeApi([task("490", "Pay the invoice")]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Pay the invoice" }));
    const dialog = screen.getByRole("dialog", { name: "Pay the invoice" });
    const title = within(dialog).getByRole("textbox", { name: "Title" });
    await user.type(title, " today");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(title).toHaveValue("Pay the invoice");
    expect(title).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(requestsTo(api, "PATCH", "/api/v1/tasks/490")).toHaveLength(0);
  });

  it("adds, checks and deletes steps on a saved item as they happen", async () => {
    const api = fakeApi([
      task("490", "Change the bicycle tire"),
      doneTask("491", "Check the size", { parentId: "490" }),
      task("492", "Order a tube", { parentId: "490" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole("button", { name: "Change the bicycle tire" });
    expect(row).toHaveAccessibleDescription("No due date, 1 of 2 steps done");
    await user.click(row);
    const dialog = screen.getByRole("dialog", { name: "Change the bicycle tire" });
    expect(within(dialog).getByText("1/2")).toBeInTheDocument();

    const stepEntry = within(dialog).getByRole("textbox", { name: "Add step" });
    await user.type(stepEntry, "Fit it{Enter}");
    expect(stepEntry).toHaveValue("");
    expect(stepEntry).toHaveFocus();
    expect(await within(dialog).findByRole("checkbox", { name: "Fit it" })).not.toBeChecked();
    expect(within(dialog).getByText("1/3")).toBeInTheDocument();
    expect(stepEntry).toHaveFocus();

    await user.click(within(dialog).getByRole("checkbox", { name: "Order a tube" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("checkbox", { name: "Order a tube" })).toBeChecked(),
    );
    expect(within(dialog).getByText("2/3")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: "Check the size" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("checkbox", { name: "Check the size" })).not.toBeChecked(),
    );

    await user.click(within(dialog).getByRole("button", { name: "Delete Fit it" }));
    await waitFor(() =>
      expect(within(dialog).queryByRole("checkbox", { name: "Fit it" })).not.toBeInTheDocument(),
    );
    expect(stepEntry).toHaveFocus();
    expect(within(dialog).getByText("1/2")).toBeInTheDocument();

    expect(await bodiesOf(requestsTo(api, "POST", "/api/v1/tasks"))).toEqual([
      { parent_id: "490", title: "Fit it" },
    ]);
    expect(requestsTo(api, "POST", "/api/v1/tasks/492/check")).toHaveLength(1);
    expect(requestsTo(api, "DELETE", "/api/v1/tasks/491/check")).toHaveLength(1);
    expect(requestsTo(api, "DELETE", "/api/v1/tasks/900")).toHaveLength(1);
    expect(row).toHaveAccessibleDescription("No due date, 1 of 2 steps done");
  });

  it("asks before completing an item with open steps from the list", async () => {
    const api = fakeApi([
      task("490", "Conference"),
      doneTask("491", "Prepare the slides", { parentId: "490" }),
      task("492", "Rehearse", { parentId: "490" }),
      task("493", "Final run", { parentId: "490" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: "Conference" });
    await user.click(checkbox);
    let dialog = screen.getByRole("dialog", { name: "Conference" });
    expect(dialog).toHaveTextContent("2 steps are not complete. Finish anyway?");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveFocus();
    expect(requestsTo(api, "POST", "/api/v1/tasks/490/check")).toHaveLength(0);

    await user.click(checkbox);
    dialog = screen.getByRole("dialog", { name: "Conference" });
    await user.click(within(dialog).getByRole("button", { name: "Finish anyway" }));

    expect(await screen.findByRole("button", { name: "Completed 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active 0" })).toBeInTheDocument();
    expect(screen.getByText("No open items.")).toBeInTheDocument();
    expect(requestsTo(api, "POST", "/api/v1/tasks/490/check")).toHaveLength(1);
  });

  it("completes an item without open steps straight from the list", async () => {
    const api = fakeApi([task("490", "Call home"), task("491", "Return the book")]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Call home" }));

    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "Call home" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Return the book" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Completed 1" })).toBeInTheDocument();
    expect(requestsTo(api, "POST", "/api/v1/tasks/490/check")).toHaveLength(1);
  });

  it("confirms finishing an item with open steps in its detail, then reopens it", async () => {
    const api = fakeApi([
      task("490", "Conference", { dueDate: "2026-10-02", startTime: "10:00" }),
      task("491", "Prepare the slides", { parentId: "490" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Conference" }));
    const dialog = screen.getByRole("dialog", { name: "Conference" });
    await user.click(within(dialog).getByRole("button", { name: "Complete" }));
    const confirmation = within(dialog).getByRole("group", {
      name: "Confirm finishing with open steps",
    });
    expect(confirmation).toHaveTextContent("1 step is not complete. Finish anyway?");
    expect(within(confirmation).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).getByRole("button", { name: "Complete" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Complete" }));
    await user.click(within(dialog).getByRole("button", { name: "Finish anyway" }));

    const reopen = await within(dialog).findByRole("button", { name: "Reopen" });
    expect(reopen).toHaveFocus();
    expect(within(dialog).getByRole("checkbox", { name: "Prepare the slides" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Completed 1" })).toBeInTheDocument();

    await user.click(reopen);
    expect(await within(dialog).findByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active 1" })).toBeInTheDocument();
    expect(requestsTo(api, "POST", "/api/v1/tasks/490/check")).toHaveLength(1);
    expect(requestsTo(api, "DELETE", "/api/v1/tasks/490/check")).toHaveLength(1);
  });

  it("reopens a completed item from the completed list", async () => {
    const api = fakeApi([doneTask("490", "Pick up the parcel")]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Completed 1" }));
    await user.click(screen.getByRole("checkbox", { name: "Pick up the parcel" }));

    expect(await screen.findByRole("button", { name: "Active 1" })).toBeInTheDocument();
    expect(screen.getByText("Nothing completed yet.")).toBeInTheDocument();
    expect(requestsTo(api, "DELETE", "/api/v1/tasks/490/check")).toHaveLength(1);
  });

  it("deletes an item with its steps after confirming", async () => {
    const api = fakeApi([
      task("490", "Conference"),
      task("491", "Prepare the slides", { parentId: "490" }),
      task("492", "Rehearse", { parentId: "490" }),
    ]);
    vi.stubGlobal("fetch", api);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Conference" }));
    const dialog = screen.getByRole("dialog", { name: "Conference" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    const confirmation = within(dialog).getByRole("group", { name: "Confirm item deletion" });
    expect(confirmation).toHaveTextContent("Delete “Conference”?");
    expect(confirmation).toHaveTextContent("Its 2 steps are deleted with it.");
    expect(within(confirmation).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete item" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("No open items.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New item" })).toHaveFocus();
    expect(requestsTo(api, "DELETE", "/api/v1/tasks/490")).toHaveLength(1);
  });

  it("keeps an item open and explains why when completing it fails", async () => {
    const api = fakeApi([task("490", "Call home")]);
    vi.stubGlobal("fetch", async (request: Request) =>
      request.method === "POST" && new URL(request.url).pathname === "/api/v1/tasks/490/check"
        ? Response.json({ code: "not_found", message: "Not found" }, { status: 404 })
        : api(request),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Call home" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This item no longer exists.");
    expect(screen.getByRole("checkbox", { name: "Call home" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Active 1" })).toBeInTheDocument();
  });
});
