import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useTaskForm } from "../hooks/useTaskForm";
import { TaskFormDialog } from "./TaskFormDialog";

const onSaved = vi.fn();
const onDeleted = vi.fn();

// The Goal entry, as Today and Week will open it.
function GoalEntry() {
  const form = useTaskForm({ onSaved, onDeleted });
  return (
    <>
      <button type="button" onClick={() => form.openCreate({ scheduledDate: "2026-09-24" })}>
        Add goal work
      </button>
      {form.draft ? (
        <TaskFormDialog
          draft={form.draft}
          dateMode="fixed"
          minimumScheduledDate="2026-09-24"
          allowNoGoal={false}
          areas={form.areas}
          goals={form.goals}
          optionsError={form.optionsError}
          error={form.formError}
          isSaving={form.isSaving}
          isConfirmingDelete={form.isConfirmingDelete}
          onGoalChange={form.setGoalId}
          onTitleChange={form.setTitle}
          onScheduledDateChange={form.setScheduledDate}
          onStartTimeChange={form.setStartTime}
          onDurationChange={form.setDurationMinutes}
          onBlockCountChange={form.setBlockCount}
          onRepeatChange={form.setRepeating}
          onWeekdayToggle={form.toggleWeekday}
          onSubmit={() => void form.saveTask()}
          onClose={form.closeForm}
          onStartDeleting={form.startDeleting}
          onCancelDeleting={form.cancelDeleting}
          onDelete={() => void form.deleteTask()}
        />
      ) : null}
    </>
  );
}

describe("TaskFormDialog", () => {
  it("creates goal work only for a chosen goal", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/v1/areas") {
        return Response.json({
          areas: [
            {
              id: "3",
              name: "Coding",
              color: "SLATE",
              archived_at: null,
              unarchived_at: null,
              created_at: "2026-09-01T09:00:00Z",
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
              title: "Finish auth flow",
              weekly_target: 3,
              created_at: "2026-09-01T09:00:00Z",
              rules: [],
            },
          ],
        });
      }
      if (request.method === "POST" && url.pathname === "/api/v1/tasks") {
        return Response.json(
          {
            id: "500",
            goal_id: "7",
            rule_id: null,
            parent_id: null,
            title: "Finish auth flow",
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
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GoalEntry />);

    await user.click(screen.getByRole("button", { name: "Add goal work" }));
    const dialog = screen.getByRole("dialog", { name: "New task" });
    const goal = within(dialog).getByLabelText("Goal");
    expect(goal).toHaveFocus();
    await within(goal).findByRole("option", { name: "Coding - Finish auth flow" });
    expect(within(goal).queryByRole("option", { name: "No goal" })).not.toBeInTheDocument();
    expect(goal).toHaveValue("");
    expect(within(dialog).queryByLabelText("Title")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();

    await user.selectOptions(goal, "7");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    const create = fetchMock.mock.calls
      .map(([request]) => request)
      .find((request) => request.method === "POST");
    expect(await create?.clone().json()).toEqual({
      goal_id: "7",
      scheduled_date: "2026-09-24",
      start_time: null,
      duration_minutes: null,
      block_count: null,
    });
  });
});
