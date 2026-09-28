import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskForm } from "./useTaskForm";

const onSaved = vi.fn();
const onDeleted = vi.fn();

describe("useTaskForm", () => {
  beforeEach(() => {
    onSaved.mockClear();
    onDeleted.mockClear();
  });

  it("opens a new task with the supplied calendar date and time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === "/api/v1/areas") {
          return Response.json({ areas: [] });
        }
        if (path === "/api/v1/goals") {
          return Response.json({ goals: [] });
        }
        throw new Error(`Unexpected request: ${request.method} ${path}`);
      }),
    );
    const { result } = renderHook(() => useTaskForm({ onSaved, onDeleted }));

    act(() => {
      result.current.openCreate({
        scheduledDate: "2026-10-01",
        startTime: "14:30",
      });
    });

    expect(result.current.draft?.scheduledDate).toBe("2026-10-01");
    expect(result.current.draft?.startTime).toBe("14:30");
    await waitFor(() => expect(result.current.areas).toEqual([]));
  });

  it("includes a changed date in a task update", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (request.method === "PATCH" && path === "/api/v1/tasks/481") {
        expect(await request.clone().json()).toEqual({
          scheduled_date: "2026-10-02",
        });
        return Response.json({
          id: "481",
          goal_id: null,
          rule_id: null,
          title: "Dentist",
          occurrence_date: null,
          scheduled_date: "2026-10-02",
          start_time: null,
          duration_minutes: null,
          end_time: null,
          block_count: null,
          period_start: "2026-09-28",
          status: "PENDING",
          completed_at: null,
        });
      }
      throw new Error(`Unexpected request: ${request.method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTaskForm({ onSaved, onDeleted }));

    act(() => {
      result.current.openEdit({
        id: "481",
        goal_id: null,
        rule_id: null,
        title: "Dentist",
        scheduled_date: "2026-09-24",
        start_time: null,
        duration_minutes: null,
        block_count: null,
      });
      result.current.setScheduledDate("2026-10-02");
    });
    await act(async () => {
      await result.current.saveTask();
    });

    expect(onSaved).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
