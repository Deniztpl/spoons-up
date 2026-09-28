import { useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { TaskFormDialog } from "../../features/tasks/components/TaskFormDialog";
import { useTaskForm } from "../../features/tasks/hooks/useTaskForm";
import { LaterTasksDialog } from "../../features/week/components/LaterTasksDialog";
import { WeekCalendar } from "../../features/week/components/WeekCalendar";
import { useWeek } from "../../features/week/hooks/useWeek";

const weekFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export function WeekPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const weekState = useWeek();
  const taskForm = useTaskForm({
    onSaved: weekState.reload,
    onDeleted: weekState.reload,
  });
  const [isLaterOpen, setIsLaterOpen] = useState(false);
  const { week, todayDate } = weekState;

  return (
    <AppLayout onLogout={onLogout}>
      {/* From md up the page is exactly the viewport below the header, so the calendar scrolls inside it. */}
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-5 sm:px-6 md:h-[calc(100vh-3.5rem)] md:flex-none md:overflow-hidden lg:px-7 lg:pt-[30px]">
        <header className="mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-3">
          <h1 className="mr-auto text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:mr-0">
            Week
          </h1>

          <div className="order-3 flex w-full items-center justify-between gap-3.5 sm:order-none sm:w-auto sm:justify-start">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous week"
                disabled={weekState.position === "current" || !todayDate || weekState.isLoading}
                className="grid size-[30px] place-items-center rounded-lg border border-ink/14 bg-card text-ink-soft transition enabled:hover:bg-well enabled:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:border-ink/7 disabled:text-muted-light"
                onClick={weekState.showCurrentWeek}
              >
                <ChevronIcon direction="left" />
              </button>
              <span className="min-w-[108px] text-center text-sm font-medium tabular-nums">
                {week ? weekLabel(week.days.map((day) => day.date)) : "Loading…"}
              </span>
              <button
                type="button"
                aria-label="Next week"
                disabled={weekState.position === "following" || !todayDate || weekState.isLoading}
                className="grid size-[30px] place-items-center rounded-lg border border-ink/14 bg-card text-ink-soft transition enabled:hover:bg-well enabled:hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:border-ink/7 disabled:text-muted-light"
                onClick={weekState.showFollowingWeek}
              >
                <ChevronIcon direction="right" />
              </button>
            </div>

            <button
              type="button"
              disabled={weekState.position === "current" || weekState.isLoading}
              className="h-8 rounded-lg border border-accent/35 bg-card px-3 text-[12.5px] font-medium text-accent transition enabled:hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:border-ink/8 disabled:text-muted-light"
              onClick={weekState.showCurrentWeek}
            >
              Today
            </button>
          </div>

          <span aria-hidden="true" className="hidden flex-1 sm:block" />

          {week && week.later_tasks.count > 0 ? (
            <button
              type="button"
              aria-label={`${week.later_tasks.count} later ${week.later_tasks.count === 1 ? "task" : "tasks"}`}
              className="inline-flex h-8 items-center gap-[7px] rounded-lg border border-ink/14 bg-card pl-3 pr-2 text-[12.5px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => setIsLaterOpen(true)}
            >
              Later
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-track px-[5px] text-[11px] font-semibold text-ink tabular-nums">
                {week.later_tasks.count}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={!todayDate}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-accent bg-accent px-3.5 text-[13px] font-medium text-white transition hover:border-accent-strong hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (todayDate) taskForm.openCreate({ scheduledDate: todayDate });
            }}
          >
            <span aria-hidden="true">+</span>
            Add task
          </button>
        </header>

        {weekState.loadError ? (
          <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-4 py-3 text-danger">
            {weekState.loadError}
          </p>
        ) : null}

        {weekState.actionError ? (
          <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {weekState.actionError}
          </p>
        ) : null}

        {week && todayDate ? (
          <WeekCalendar
            week={week}
            todayDate={todayDate}
            pendingTaskIds={weekState.pendingTaskIds}
            onCreate={taskForm.openCreate}
            onEdit={taskForm.openEdit}
            onToggle={(task) => void weekState.toggleTask(task)}
            onMove={(task, scheduledDate, startTime) =>
              void weekState.moveTask(task, scheduledDate, startTime)
            }
          />
        ) : weekState.isLoading ? (
          <div role="status" className="grid flex-1 place-items-center text-ink-soft">
            Loading week…
          </div>
        ) : null}
      </div>

      {taskForm.draft && todayDate ? (
        <TaskFormDialog
          draft={taskForm.draft}
          dateMode="editable"
          minimumScheduledDate={todayDate}
          areas={taskForm.areas}
          goals={taskForm.goals}
          optionsError={taskForm.optionsError}
          error={taskForm.formError}
          isSaving={taskForm.isSaving}
          isConfirmingDelete={taskForm.isConfirmingDelete}
          onGoalChange={taskForm.setGoalId}
          onTitleChange={taskForm.setTitle}
          onScheduledDateChange={taskForm.setScheduledDate}
          onStartTimeChange={taskForm.setStartTime}
          onDurationChange={taskForm.setDurationMinutes}
          onBlockCountChange={taskForm.setBlockCount}
          onRepeatChange={taskForm.setRepeating}
          onWeekdayToggle={taskForm.toggleWeekday}
          onSubmit={() => void taskForm.saveTask()}
          onClose={taskForm.closeForm}
          onStartDeleting={taskForm.startDeleting}
          onCancelDeleting={taskForm.cancelDeleting}
          onDelete={() => void taskForm.deleteTask()}
        />
      ) : null}

      {isLaterOpen && week ? (
        <LaterTasksDialog
          tasks={week.later_tasks.items}
          onSelect={(task) => {
            setIsLaterOpen(false);
            taskForm.openEdit(task);
          }}
          onClose={() => setIsLaterOpen(false)}
        />
      ) : null}
    </AppLayout>
  );
}

function weekLabel(dates: string[]) {
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return "";
  return weekFormat.formatRange(localDate(first), localDate(last));
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none">
      <path
        d={direction === "left" ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
