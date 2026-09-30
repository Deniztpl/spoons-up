import { useState } from "react";
import { Link } from "react-router";

import { AppLayout } from "../../components/layout/AppLayout";
import { useAreaLookup } from "../../features/areas/hooks/useAreaLookup";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { JournalTaskDialog } from "../../features/journal/components/JournalTaskDialog";
import { OpenStepsDialog } from "../../features/journal/components/OpenStepsDialog";
import { useJournalTaskForm } from "../../features/journal/hooks/useJournalTaskForm";
import { useProgress } from "../../features/results/hooks/useProgress";
import { TaskFormDialog } from "../../features/tasks/components/TaskFormDialog";
import { useTaskForm } from "../../features/tasks/hooks/useTaskForm";
import type { LeftBehindItem, Today, TodayTask } from "../../features/today/api/todayApi";
import { TodayHabitList } from "../../features/today/components/TodayHabitList";
import { TodayLeftBehindList } from "../../features/today/components/TodayLeftBehindList";
import { TodayTaskList } from "../../features/today/components/TodayTaskList";
import { TodayWeekPanel } from "../../features/today/components/TodayWeekPanel";
import {
  type TodayView,
  TodayViewSelector,
} from "../../features/today/components/TodayViewSelector";
import { useToday } from "../../features/today/hooks/useToday";

const dayFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const weekFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const addButtonClassName =
  "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-accent/35 bg-card px-2.5 text-[12.5px] font-medium text-accent transition hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TodayPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const todayState = useToday();
  const progressState = useProgress();
  const areaLookup = useAreaLookup();
  // Checking work off or changing a task moves this week's progress.
  const reloadAll = () => {
    todayState.reload();
    progressState.reload();
  };
  const refreshProgressAfter = async (change: Promise<unknown>) => {
    await change;
    progressState.reload();
  };
  const taskForm = useTaskForm({
    onSaved: reloadAll,
    onDeleted: reloadAll,
  });
  const journalForm = useJournalTaskForm({ onSaved: reloadAll });
  const [view, setView] = useState<TodayView>("daily");
  const [confirmingTask, setConfirmingTask] = useState<TodayTask | null>(null);
  const { today } = todayState;
  const leftBehind = today?.left_behind;
  const leftBehindCount = leftBehind?.count ?? 0;
  // Left behind is offered only while it has rows; once it empties, Today shows the day again.
  const shownView: TodayView = view === "left-behind" && leftBehindCount === 0 ? "daily" : view;
  const habits = today
    ? shownView === "daily"
      ? today.daily_habits
      : shownView === "weekly"
        ? today.weekly_habits
        : []
    : [];
  const tasks = today && shownView === "daily" ? today.tasks : [];

  // Moving the last row closes the view.
  const moveToToday = async (item: LeftBehindItem) => {
    const wasLast = leftBehindCount === 1;
    if ((await todayState.moveToToday(item)) && wasLast) {
      setView("daily");
    }
  };

  // A step and its item show each other's progress, and finishing an item takes its open steps
  // off the day, so checking either reads the day again.
  const toggleTask = async (task: TodayTask) => {
    await todayState.toggleTask(task);
    if (task.parent || task.step_progress) {
      todayState.reload();
    }
    progressState.reload();
  };

  // Finishing an item with open steps asks first.
  const requestToggle = (task: TodayTask) => {
    const openSteps = task.step_progress ? task.step_progress.total - task.step_progress.done : 0;
    if (task.status !== "DONE" && openSteps > 0) {
      setConfirmingTask(task);
      return;
    }
    void toggleTask(task);
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="flex flex-1 justify-center px-4 py-6 sm:px-8 sm:py-8 lg:px-[30px] lg:pt-[34px]">
          <div className="grid w-full max-w-[464px] content-start gap-y-5 sm:grid-cols-[96px_minmax(0,340px)] sm:gap-x-7 sm:gap-y-[26px]">
            <div className="flex items-start justify-between gap-3 sm:col-start-2">
              <div className="min-w-0">
                <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em]">
                  Today
                </h1>
                {today ? (
                  <p className="whitespace-nowrap text-[13px] text-ink-soft">
                    {dateLabel(today, shownView)}
                  </p>
                ) : null}
              </div>
              {today && shownView === "daily" ? (
                <div className="flex shrink-0 gap-1.5 pt-1.5">
                  <button
                    type="button"
                    aria-label="Add goal task"
                    className={addButtonClassName}
                    onClick={() => taskForm.openCreate({ scheduledDate: today.date })}
                  >
                    <span aria-hidden="true">+</span>
                    Goal
                  </button>
                  <button
                    type="button"
                    aria-label="Add Journal task"
                    className={addButtonClassName}
                    onClick={() => journalForm.open({ scheduledDate: today.date })}
                  >
                    <span aria-hidden="true">+</span>
                    Journal
                  </button>
                </div>
              ) : null}
            </div>

            <TodayViewSelector
              value={shownView}
              leftBehindCount={leftBehindCount}
              onChange={setView}
            />

            {/* The left gutter holds the task list's progress rail. */}
            <section
              aria-label={
                shownView === "daily"
                  ? "Today's tasks and habits"
                  : shownView === "weekly"
                    ? "Weekly habits"
                    : "Work left behind"
              }
              className="flex min-w-0 flex-col gap-2 pl-[26px]"
            >
              {todayState.isLoading ? (
                <p role="status" className="text-ink-soft">
                  Loading today…
                </p>
              ) : null}

              {todayState.loadError ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-danger">
                  {todayState.loadError}
                </p>
              ) : null}

              {todayState.actionError ? (
                <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">
                  {todayState.actionError}
                </p>
              ) : null}

              {today && leftBehind && shownView === "left-behind" ? (
                <TodayLeftBehindList
                  items={leftBehind.items}
                  today={today.date}
                  areaByGoalId={areaLookup.areaByGoalId}
                  pendingTaskIds={todayState.pendingTaskIds}
                  onMove={(item) => void moveToToday(item)}
                />
              ) : null}

              {tasks.length > 0 ? (
                <TodayTaskList
                  tasks={tasks}
                  areaByGoalId={areaLookup.areaByGoalId}
                  pendingTaskIds={todayState.pendingTaskIds}
                  onToggle={requestToggle}
                  onEdit={taskForm.openEdit}
                />
              ) : null}

              {today && habits.length > 0 ? (
                <TodayHabitList
                  habits={habits}
                  areaById={areaLookup.areaById}
                  pendingHabitIds={todayState.pendingHabitIds}
                  onToggle={(habit) => void refreshProgressAfter(todayState.toggleHabit(habit))}
                />
              ) : null}

              {today && shownView !== "left-behind" && habits.length === 0 && tasks.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-ink/16 px-5 py-7 text-center">
                  <h2 className="text-[13.5px] font-medium">
                    {shownView === "daily" ? "No daily habits yet" : "No weekly habits yet"}
                  </h2>
                  <p className="mt-1 text-[13px] leading-5 text-ink-soft">
                    Add habits to an area and they will show up here.
                  </p>
                  <Link
                    to="/areas"
                    className="mt-3 inline-block text-[13px] font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Go to Areas
                  </Link>
                </div>
              ) : null}
            </section>
          </div>
        </div>

        <TodayWeekPanel areas={progressState.areas} loadError={progressState.loadError} />
      </div>

      {taskForm.draft ? (
        <TaskFormDialog
          draft={taskForm.draft}
          dateMode="fixed"
          minimumScheduledDate={today?.date ?? taskForm.draft.scheduledDate}
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

      {journalForm.draft && today ? (
        <JournalTaskDialog
          draft={journalForm.draft}
          dateMode="fixed"
          today={today.date}
          items={journalForm.items}
          loadError={journalForm.loadError}
          error={journalForm.formError}
          isSaving={journalForm.isSaving}
          onChoose={journalForm.choose}
          onNewTitleChange={journalForm.setNewTitle}
          onScheduledDateChange={journalForm.setScheduledDate}
          onStartTimeChange={journalForm.setStartTime}
          onDurationChange={journalForm.setDurationMinutes}
          onBlockCountChange={journalForm.setBlockCount}
          onSubmit={() => void journalForm.save()}
          onClose={journalForm.close}
        />
      ) : null}

      {confirmingTask?.step_progress ? (
        <OpenStepsDialog
          title={confirmingTask.title}
          openCount={confirmingTask.step_progress.total - confirmingTask.step_progress.done}
          onCancel={() => setConfirmingTask(null)}
          onConfirm={() => {
            setConfirmingTask(null);
            void toggleTask(confirmingTask);
          }}
        />
      ) : null}
    </AppLayout>
  );
}

function dateLabel(today: Today, view: TodayView) {
  return view === "weekly"
    ? weekFormat.formatRange(localDate(today.week_start), localDate(today.week_end))
    : dayFormat.format(localDate(today.date));
}

// Avoid UTC shifts for date-only values.
function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
