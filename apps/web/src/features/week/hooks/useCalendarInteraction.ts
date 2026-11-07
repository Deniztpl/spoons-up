import { type PointerEvent, useEffect, useRef, useState } from "react";

import type { WeekTask } from "../api/weekApi";
import { DAY_MINUTES, minutesToTime, timeToMinutes } from "../calendarTime";
import type { TaskPlacement } from "./useWeek";

const SNAP_MINUTES = 15;
const LAST_START_MINUTES = DAY_MINUTES - SNAP_MINUTES;
// A press that moves less than this many pixels stays a click.
const DRAG_THRESHOLD = 4;
// A goal dropped from the hours panel proposes an hour of its work, as a double-click does.
export const ADDED_GOAL_MINUTES = 60;

// The part of a day the pointer is over: its timeline, or its untimed row.
export type CalendarColumn = {
  date: string;
  zone: "timeline" | "untimed";
  isPast: boolean;
};

// A goal picked up from the hours panel.
export type DraggedGoal = { goalId: string; title: string };

// A day and a start on it; a null start is the day's untimed row.
type DropTarget = { date: string; startMinutes: number | null };

export type CalendarInteraction =
  // Where a dragged task would land; null over an elapsed day.
  | { kind: "move"; task: WeekTask; target: DropTarget | null }
  | { kind: "resize"; task: WeekTask; durationMinutes: number }
  | { kind: "draw"; date: string; startMinutes: number; endMinutes: number }
  // A goal from the hours panel: where its new task would go, null off the calendar or over an
  // elapsed day, and the pointer, which a chip follows while there is no slot under it.
  | { kind: "add"; goal: DraggedGoal; target: DropTarget | null; x: number; y: number };

type Press =
  | { kind: "move"; task: WeekTask; offsetMinutes: number; x: number; y: number }
  | { kind: "resize"; task: WeekTask; x: number; y: number }
  | { kind: "draw"; date: string; anchorMinutes: number; x: number; y: number }
  | { kind: "add"; goal: DraggedGoal; x: number; y: number };

type InteractionCallbacks = {
  onPlace: (task: WeekTask, placement: TaskPlacement) => void;
  onDraw: (range: { scheduledDate: string; startTime: string; durationMinutes: number }) => void;
  onAdd: (defaults: {
    goalId: string;
    scheduledDate: string;
    startTime?: string;
    durationMinutes: number;
  }) => void;
};

export type CalendarPointer = ReturnType<typeof useCalendarInteraction>;

// Moving, resizing and drawing on the week's timeline with the pointer, in 15-minute steps, and
// dropping a goal on it from the hours panel.
export function useCalendarInteraction(
  { onPlace, onDraw, onAdd }: InteractionCallbacks,
  hourHeight: number,
) {
  const [interaction, setInteraction] = useState<CalendarInteraction | null>(null);
  const interactionRef = useRef<CalendarInteraction | null>(null);
  const pressRef = useRef<Press | null>(null);
  const ignoreClickRef = useRef(false);
  // The last pointer move a calendar column handled, so a move anywhere else lets go of the slot.
  const columnMoveRef = useRef<Event | null>(null);

  const show = (next: CalendarInteraction | null) => {
    interactionRef.current = next;
    setInteraction(next);
  };

  useEffect(() => {
    const commit = (finished: CalendarInteraction) => {
      if (finished.kind === "move") {
        const { task, target } = finished;
        if (!target) return;
        const startTime = target.startMinutes === null ? null : minutesToTime(target.startMinutes);
        const placement: TaskPlacement = {};
        if (target.date !== task.scheduled_date) placement.scheduled_date = target.date;
        if (startTime !== task.start_time) placement.start_time = startTime;
        if (Object.keys(placement).length > 0) onPlace(task, placement);
      } else if (finished.kind === "resize") {
        if (finished.durationMinutes !== finished.task.duration_minutes) {
          onPlace(finished.task, { duration_minutes: finished.durationMinutes });
        }
      } else if (finished.kind === "add") {
        const { goal, target } = finished;
        if (!target) return;
        onAdd({
          goalId: goal.goalId,
          scheduledDate: target.date,
          ...(target.startMinutes === null ? {} : { startTime: minutesToTime(target.startMinutes) }),
          durationMinutes: ADDED_GOAL_MINUTES,
        });
      } else {
        onDraw({
          scheduledDate: finished.date,
          startTime: minutesToTime(finished.startMinutes),
          durationMinutes: finished.endMinutes - finished.startMinutes,
        });
      }
    };

    const finish = () => {
      const finished = interactionRef.current;
      pressRef.current = null;
      if (!finished) return;
      show(null);
      // The release that ends a drag is not a click on whatever lies under it.
      ignoreClickRef.current = true;
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
      commit(finished);
    };
    const cancel = () => {
      pressRef.current = null;
      if (interactionRef.current) show(null);
    };
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactionRef.current) {
        event.preventDefault();
        cancel();
      }
    };
    // A goal is followed across the whole page: the chip tracks the pointer, and a move that no
    // calendar column handled has no slot under it. Columns see the move first, as it bubbles.
    const followGoal = (event: globalThis.PointerEvent) => {
      const press = pressRef.current;
      if (press?.kind !== "add") return;
      let current = interactionRef.current;
      if (!current) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
        current = startFrom(press);
      }
      if (current.kind !== "add") return;
      show({
        ...current,
        target: columnMoveRef.current === event ? current.target : null,
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("pointermove", followGoal);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("pointermove", followGoal);
    };
  }, [onPlace, onDraw, onAdd]);

  // A task is pressed: its body moves it, its bottom edge resizes it.
  const pressTask = (event: PointerEvent<HTMLElement>, task: WeekTask, mode: "move" | "resize") => {
    if (event.button !== 0 || pressRef.current) return;
    if (mode === "resize") {
      pressRef.current = { kind: "resize", task, x: event.clientX, y: event.clientY };
      return;
    }
    // Keep the point the task was grabbed by under the pointer.
    let offsetMinutes = 0;
    if (task.start_time !== null) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
      offsetMinutes = snap((relativeY / Math.max(bounds.height, 1)) * (task.duration_minutes ?? 60));
    }
    pressRef.current = { kind: "move", task, offsetMinutes, x: event.clientX, y: event.clientY };
  };

  // An empty slot is pressed: dragging from it draws a new task's range.
  const pressSlot = (event: PointerEvent<HTMLElement>, date: string) => {
    if (event.button !== 0 || pressRef.current) return;
    pressRef.current = {
      kind: "draw",
      date,
      anchorMinutes: clamp(floorSnap(pointerMinutes(event, hourHeight)), 0, LAST_START_MINUTES),
      x: event.clientX,
      y: event.clientY,
    };
  };

  // A goal is picked up from the hours panel, to be dropped on a slot or a day's untimed row.
  const pressGoal = (event: PointerEvent<HTMLElement>, goal: DraggedGoal) => {
    if (event.button !== 0 || pressRef.current) return;
    // Dragging out of the panel should not select its text.
    event.preventDefault();
    pressRef.current = { kind: "add", goal, x: event.clientX, y: event.clientY };
  };

  const moveOver = (event: PointerEvent<HTMLElement>, column: CalendarColumn) => {
    const press = pressRef.current;
    if (!press) return;
    let current = interactionRef.current;
    if (!current) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
      current = startFrom(press);
    }
    columnMoveRef.current = event.nativeEvent;
    const minutes = column.zone === "timeline" ? pointerMinutes(event, hourHeight) : null;
    show(follow(current, press, column, minutes));
  };

  return {
    interaction,
    pressTask,
    pressSlot,
    pressGoal,
    moveOver,
    isClickIgnored: () => ignoreClickRef.current,
  };
}

function startFrom(press: Press): CalendarInteraction {
  if (press.kind === "move") {
    return { kind: "move", task: press.task, target: null };
  }
  if (press.kind === "resize") {
    return { kind: "resize", task: press.task, durationMinutes: press.task.duration_minutes ?? 60 };
  }
  if (press.kind === "add") {
    return { kind: "add", goal: press.goal, target: null, x: press.x, y: press.y };
  }
  return {
    kind: "draw",
    date: press.date,
    startMinutes: press.anchorMinutes,
    endMinutes: press.anchorMinutes + SNAP_MINUTES,
  };
}

function follow(
  current: CalendarInteraction,
  press: Press,
  column: CalendarColumn,
  minutes: number | null,
): CalendarInteraction {
  if (current.kind === "move" && press.kind === "move") {
    if (column.isPast) {
      return { ...current, target: null };
    }
    const startMinutes =
      minutes === null
        ? null
        : clamp(snap(minutes - press.offsetMinutes), 0, LAST_START_MINUTES);
    return { ...current, target: { date: column.date, startMinutes } };
  }
  if (current.kind === "add") {
    if (column.isPast) {
      return { ...current, target: null };
    }
    // The new task starts at the quarter hour under the pointer, as a double-click proposes.
    const startMinutes =
      minutes === null ? null : clamp(floorSnap(minutes), 0, LAST_START_MINUTES);
    return { ...current, target: { date: column.date, startMinutes } };
  }
  if (minutes === null) {
    return current;
  }
  if (current.kind === "resize" && current.task.start_time !== null) {
    const start = timeToMinutes(current.task.start_time);
    return {
      ...current,
      durationMinutes: clamp(snap(minutes - start), SNAP_MINUTES, DAY_MINUTES - start),
    };
  }
  if (current.kind === "draw" && press.kind === "draw") {
    // Down from the pressed quarter hour the range ends at the nearest line; up from it, the
    // range starts at the quarter hour under the pointer and keeps the pressed one.
    const anchor = press.anchorMinutes;
    return minutes >= anchor
      ? {
          ...current,
          startMinutes: anchor,
          endMinutes: clamp(snap(minutes), anchor + SNAP_MINUTES, DAY_MINUTES),
        }
      : {
          ...current,
          startMinutes: clamp(floorSnap(minutes), 0, anchor),
          endMinutes: anchor + SNAP_MINUTES,
        };
  }
  return current;
}

function pointerMinutes(event: PointerEvent<HTMLElement>, hourHeight: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return ((event.clientY - bounds.top) / hourHeight) * 60;
}

function snap(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function floorSnap(minutes: number) {
  return Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
