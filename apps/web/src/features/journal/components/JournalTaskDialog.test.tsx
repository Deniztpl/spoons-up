import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useJournalTaskForm } from "../hooks/useJournalTaskForm";
import { JournalTaskDialog } from "./JournalTaskDialog";

const onSaved = vi.fn();

type Fields = Record<string, unknown>;

function item(id: string, title: string, fields: Fields = {}, steps: Fields[] = []) {
  return {
    id,
    title,
    due_date: null,
    scheduled_date: null,
    start_time: null,
    duration_minutes: null,
    end_time: null,
    block_count: null,
    status: "PENDING",
    completed_at: null,
    progress: {
      done: steps.filter((step) => step.status === "DONE").length,
      total: steps.length,
    },
    steps,
    ...fields,
  };
}

function step(id: string, parentId: string, title: string, fields: Fields = {}) {
  return {
    id,
    parent_id: parentId,
    title,
    scheduled_date: null,
    start_time: null,
    duration_minutes: null,
    end_time: null,
    block_count: null,
    status: "PENDING",
    completed_at: null,
    ...fields,
  };
}

// Open Journal items in the API's order; today is 2026-09-24.
const journal = {
  today: "2026-09-24",
  active: [
    item("480", "Renew the lease", { due_date: "2026-09-18", scheduled_date: "2026-09-18" }),
    item("481", "Pay the invoice", {
      due_date: "2026-09-24",
      scheduled_date: "2026-09-24",
      start_time: "14:00",
    }),
    item(
      "482",
      "Conference",
      { due_date: "2026-10-02", scheduled_date: "2026-10-02", start_time: "10:00" },
      [
        step("483", "482", "Prepare the slides", { status: "DONE" }),
        step("484", "482", "Rehearse"),
        step("485", "482", "Book the train", { scheduled_date: "2026-09-24" }),
      ],
    ),
    item("486", "Dentist", {
      due_date: "2026-10-08",
      scheduled_date: "2026-10-08",
      start_time: "09:30",
      duration_minutes: 45,
    }),
    item("487", "Call the bank", { scheduled_date: "2026-09-24" }),
    item("488", "Wash the car", {}, [step("489", "488", "Buy soap", { status: "DONE" })]),
    item("490", "Buy a gift"),
    item("491", "Return the book"),
    item("492", "Fix the shelf"),
    item("493", "Order paint"),
  ],
  completed: [],
};

function taskResponse(fields: Fields, status = 200) {
  return Response.json(
    {
      id: "0",
      goal_id: null,
      rule_id: null,
      parent_id: null,
      title: "",
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
      ...fields,
    },
    { status },
  );
}

function stubApi() {
  const fetchMock = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/v1/journal") {
      return Response.json(journal);
    }
    if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
      return taskResponse({ id: "900", ...(await request.clone().json()) }, 201);
    }
    if (request.method === "PATCH") {
      return taskResponse({ id: url.pathname.split("/").at(-1), ...(await request.clone().json()) });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Today's plan component, as a page opens it.
function Harness() {
  const form = useJournalTaskForm({ onSaved });
  return (
    <>
      <button type="button" onClick={() => form.open({ scheduledDate: "2026-09-24" })}>
        Plan Journal work
      </button>
      {form.draft ? (
        <JournalTaskDialog
          draft={form.draft}
          dateMode="fixed"
          today="2026-09-24"
          items={form.items}
          loadError={form.loadError}
          error={form.formError}
          isSaving={form.isSaving}
          onChoose={form.choose}
          onNewTitleChange={form.setNewTitle}
          onScheduledDateChange={form.setScheduledDate}
          onStartTimeChange={form.setStartTime}
          onDurationChange={form.setDurationMinutes}
          onBlockCountChange={form.setBlockCount}
          onSubmit={() => void form.save()}
          onClose={form.close}
        />
      ) : null}
    </>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Plan Journal work" }));
  const dialog = screen.getByRole("dialog", { name: "Journal task" });
  const list = await within(dialog).findByRole("list", { name: "Open Journal items" });
  return { dialog, list };
}

function rowTitles(list: HTMLElement) {
  return within(list)
    .getAllByRole("button")
    .map((row) => document.getElementById(row.getAttribute("aria-labelledby") ?? "")?.textContent);
}

async function bodiesOf(fetchMock: ReturnType<typeof stubApi>, method: string) {
  return Promise.all(
    fetchMock.mock.calls
      .map(([request]) => request)
      .filter((request) => request.method === method)
      .map((request) => request.clone().json()),
  );
}

describe("JournalTaskDialog", () => {
  beforeEach(() => {
    onSaved.mockClear();
  });

  it("lists open work for the day five at a time and opens an item's open steps", async () => {
    stubApi();
    const user = userEvent.setup();
    const { dialog, list } = await openDialog(user);

    expect(within(dialog).getByRole("button", { name: "New task" })).toHaveFocus();
    expect(rowTitles(list)).toEqual([
      "Renew the lease",
      "Conference",
      "Dentist",
      "Buy a gift",
      "Return the book",
    ]);
    expect(within(list).getByText("Fri, Sep 18")).toHaveClass("text-danger");
    expect(within(list).getByRole("button", { name: "Conference" })).toHaveAccessibleDescription(
      "Due Fri, Oct 2 at 10:00, 1 of 3 steps done",
    );

    await user.click(within(dialog).getByRole("button", { name: "Show all (7)" }));
    expect(rowTitles(list)).toEqual([
      "Renew the lease",
      "Conference",
      "Dentist",
      "Buy a gift",
      "Return the book",
      "Fix the shelf",
      "Order paint",
    ]);

    await user.click(within(list).getByRole("button", { name: "Conference" }));
    const back = within(dialog).getByRole("button", { name: "Back from Conference" });
    expect(back).toHaveFocus();
    const steps = within(dialog).getByRole("list", { name: "Open steps of Conference" });
    expect(within(steps).getAllByRole("button").map((row) => row.textContent)).toEqual([
      "Rehearse",
    ]);
    expect(within(dialog).queryByRole("button", { name: "Conference" })).not.toBeInTheDocument();

    await user.click(back);
    expect(within(dialog).getByRole("button", { name: "Conference" })).toHaveFocus();
  });

  it("plans a chosen item with its own time and duration", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    const { dialog, list } = await openDialog(user);

    await user.click(within(list).getByRole("button", { name: "Dentist" }));
    expect(within(dialog).getByRole("group", { name: "Chosen task" })).toHaveTextContent("Dentist");
    expect(within(dialog).getByRole("button", { name: "Change" })).toHaveFocus();
    expect(within(dialog).getByLabelText("Start time")).toHaveValue("09:30");
    expect(within(dialog).getByLabelText("Duration")).toHaveValue("45");
    await user.click(within(dialog).getByRole("button", { name: "Add to today" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await bodiesOf(fetchMock, "PATCH")).toEqual([
      { scheduled_date: "2026-09-24", start_time: "09:30", duration_minutes: 45, block_count: null },
    ]);
    expect(fetchMock.mock.calls[1]?.[0].url).toMatch(/\/api\/v1\/tasks\/486$/);
    expect(await bodiesOf(fetchMock, "POST")).toEqual([]);
  });

  it("plans one open step of an item with the plan it is given", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    const { dialog, list } = await openDialog(user);

    await user.click(within(list).getByRole("button", { name: "Conference" }));
    await user.click(within(dialog).getByRole("button", { name: "Rehearse" }));
    const chosen = within(dialog).getByRole("group", { name: "Chosen task" });
    expect(chosen).toHaveTextContent("Conference");
    expect(chosen).toHaveTextContent("Rehearse");
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "15:00" } });
    await user.selectOptions(within(dialog).getByLabelText("Duration"), "30");
    await user.click(within(dialog).getByRole("radio", { name: "1 block" }));
    await user.click(within(dialog).getByRole("button", { name: "Add to today" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(await bodiesOf(fetchMock, "PATCH")).toEqual([
      { scheduled_date: "2026-09-24", start_time: "15:00", duration_minutes: 30, block_count: 1 },
    ]);
    expect(fetchMock.mock.calls[1]?.[0].url).toMatch(/\/api\/v1\/tasks\/484$/);
  });

  it("adds a new task for the day from a title", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    const { dialog } = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "New task" }));
    const title = within(dialog).getByRole("textbox", { name: "New task title" });
    expect(title).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Journal task" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "New task" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "New task" }));
    await user.type(within(dialog).getByRole("textbox", { name: "New task title" }), "Buy stamps{Enter}");

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(await bodiesOf(fetchMock, "POST")).toEqual([
      {
        title: "Buy stamps",
        scheduled_date: "2026-09-24",
        start_time: null,
        duration_minutes: null,
        block_count: null,
      },
    ]);
  });
});
