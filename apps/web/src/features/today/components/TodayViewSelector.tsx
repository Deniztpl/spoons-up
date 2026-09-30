export type TodayView = "daily" | "weekly" | "left-behind";

type TodayViewSelectorProps = {
  value: TodayView;
  // Left behind is offered only while it has rows.
  leftBehindCount: number;
  onChange: (view: TodayView) => void;
};

type ViewOption = {
  value: TodayView;
  label: string;
  markerClassName: string;
  pressedClassName: string;
};

const viewOptions: ViewOption[] = [
  {
    value: "daily",
    label: "Daily",
    markerClassName: "rounded-[2px] bg-accent",
    pressedClassName: "bg-accent/8",
  },
  {
    value: "weekly",
    label: "Weekly",
    markerClassName: "rounded-full bg-habit",
    pressedClassName: "bg-habit/8",
  },
  {
    value: "left-behind",
    label: "Left behind",
    markerClassName: "rounded-[2px] bg-danger",
    pressedClassName: "bg-danger-soft",
  },
];

export function TodayViewSelector({ value, leftBehindCount, onChange }: TodayViewSelectorProps) {
  const options = viewOptions.filter(
    (option) => option.value !== "left-behind" || leftBehindCount > 0,
  );
  // Left behind with its count is wider than the column, so the group may reach into the gap.
  return (
    <div
      role="group"
      aria-label="Today views"
      className="flex gap-0.5 text-[13px] font-medium sm:w-max sm:flex-col sm:self-start"
    >
      {options.map((option) => {
        const isPressed = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isPressed}
            className={`flex items-center gap-[9px] whitespace-nowrap rounded-lg px-2.5 py-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isPressed
                ? `${option.pressedClassName} text-ink`
                : "text-ink-soft hover:text-ink"
            }`}
            onClick={() => onChange(option.value)}
          >
            <span
              aria-hidden="true"
              className={`size-1.5 ${
                isPressed ? option.markerClassName : "rounded-full bg-muted-light"
              }`}
            />
            {option.label}
            {option.value === "left-behind" ? (
              <>
                {" "}
                <span className="-ml-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-track px-[5px] text-[11px] font-semibold text-ink tabular-nums">
                  {leftBehindCount}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
