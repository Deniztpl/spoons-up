import { useState } from "react";
import { Link } from "react-router";

import { AppLayout } from "../../components/layout/AppLayout";
import type { AuthActionResult } from "../../features/auth/AuthContext";
import { GoalFormDialog } from "../../features/goals/components/GoalFormDialog";
import { useGoalForm } from "../../features/goals/hooks/useGoalForm";
import type { Today } from "../../features/today/api/todayApi";
import { TodayHabitList } from "../../features/today/components/TodayHabitList";
import { TodayTaskList } from "../../features/today/components/TodayTaskList";
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

export function TodayPage({
  onLogout,
}: {
  onLogout: () => Promise<AuthActionResult>;
}) {
  const todayState = useToday();
  // A saved goal can add tasks to today.
  const goalForm = useGoalForm({
    onSaved: todayState.reload,
    onDeleted: todayState.reload,
  });
  const [view, setView] = useState<TodayView>("daily");
  const { today } = todayState;
  const habits = today ? (view === "daily" ? today.daily_habits : today.weekly_habits) : [];
  const tasks = today && view === "daily" ? today.tasks : [];

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex flex-1 justify-center px-4 py-6 sm:px-8 sm:py-8 lg:px-[30px] lg:pt-[34px]">
        <div className="grid w-full max-w-[464px] content-start gap-y-5 sm:grid-cols-[96px_minmax(0,340px)] sm:gap-x-7 sm:gap-y-[26px]">
          <div className="flex items-baseline justify-between gap-3.5 sm:col-start-2">
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em]">Today</h1>
            {today ? (
              <span className="whitespace-nowrap text-[13px] text-ink-soft">
                {dateLabel(today, view)}
              </span>
            ) : null}
          </div>

          <TodayViewSelector value={view} onChange={setView} />

          {/* The left gutter holds the task list's progress rail. */}
          <section
            aria-label={view === "daily" ? "Today's tasks and habits" : "Weekly habits"}
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

            {tasks.length > 0 ? (
              <TodayTaskList
                tasks={tasks}
                pendingTaskIds={todayState.pendingTaskIds}
                onToggle={(task) => void todayState.toggleTask(task)}
              />
            ) : null}

            {today && view === "daily" ? (
              <button
                type="button"
                className="flex h-8 items-center gap-2.5 rounded-[10px] border border-dashed border-ink/18 pl-[13px] pr-2 text-left text-[13.5px] font-medium text-ink-soft transition hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => goalForm.openCreate(null)}
              >
                <span aria-hidden="true" className="w-4 text-center text-base leading-none">
                  +
                </span>
                Add goal
              </button>
            ) : null}

            {today && habits.length > 0 ? (
              <TodayHabitList
                habits={habits}
                pendingHabitIds={todayState.pendingHabitIds}
                onToggle={(habit) => void todayState.toggleHabit(habit)}
              />
            ) : null}

            {today && habits.length === 0 && tasks.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-ink/16 px-5 py-7 text-center">
                <h2 className="text-[13.5px] font-medium">
                  {view === "daily" ? "No daily habits yet" : "No weekly habits yet"}
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
          {/* TODO(slice-5): add weekly area progress. */}
        </div>
      </div>

      {goalForm.draft ? (
        <GoalFormDialog
          areaName={null}
          areaOptions={goalForm.areaOptions}
          draft={goalForm.draft}
          error={goalForm.formError}
          isSaving={goalForm.isSaving}
          isConfirmingDelete={goalForm.isConfirmingDelete}
          onAreaChange={goalForm.setAreaId}
          onTitleChange={goalForm.setTitle}
          onWeeklyTargetChange={goalForm.setWeeklyTarget}
          onRepeatChange={goalForm.setRepeating}
          onAddRule={goalForm.addRule}
          onRuleChange={goalForm.changeRule}
          onRemoveRule={goalForm.removeRule}
          onSubmit={() => void goalForm.saveGoal()}
          onClose={goalForm.closeForm}
          onStartDeleting={goalForm.startDeleting}
          onCancelDeleting={goalForm.cancelDeleting}
          onDelete={() => void goalForm.deleteGoal()}
        />
      ) : null}
    </AppLayout>
  );
}

function dateLabel(today: Today, view: TodayView) {
  return view === "daily"
    ? dayFormat.format(localDate(today.date))
    : weekFormat.formatRange(localDate(today.week_start), localDate(today.week_end));
}

// Avoid UTC shifts for date-only values.
function localDate(value: string) {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
}
