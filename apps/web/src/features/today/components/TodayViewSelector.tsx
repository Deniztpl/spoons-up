export type TodayView = "daily" | "weekly";

type TodayViewSelectorProps = {
  value: TodayView;
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
];

export function TodayViewSelector({ value, onChange }: TodayViewSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Today views"
      className="flex gap-0.5 text-[13px] font-medium sm:flex-col sm:self-start"
    >
      {viewOptions.map((option) => {
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
          </button>
        );
      })}
    </div>
  );
}
