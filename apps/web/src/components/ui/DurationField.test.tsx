import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { DurationField } from "./DurationField";

function Field({ initial, isOptional }: { initial: number | null; isOptional?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <span id="duration-label">Duration</span>
      <DurationField
        labelledBy="duration-label"
        value={value}
        isOptional={isOptional}
        onChange={setValue}
      />
    </>
  );
}

describe("DurationField", () => {
  it("steps a required duration by quarter hours without going below 15 minutes or past a day", async () => {
    const user = userEvent.setup();
    render(<Field initial={30} />);
    const duration = screen.getByRole("spinbutton", { name: "Duration" });

    await user.click(screen.getByRole("button", { name: "Shorter" }));
    expect(duration).toHaveTextContent("15m");
    expect(screen.getByRole("button", { name: "Shorter" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "None" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "4 hours" }));
    duration.focus();
    await user.keyboard("{ArrowUp}");
    expect(duration).toHaveTextContent("4h 15m");
    expect(duration).toHaveAttribute("aria-valuetext", "4 hours 15 minutes");

    for (let step = 0; step < 80; step += 1) {
      await user.keyboard("{ArrowUp}");
    }
    expect(duration).toHaveTextContent("24h");
    expect(screen.getByRole("button", { name: "Longer" })).toBeDisabled();
  });

  it("lets an optional duration be cleared and started again", async () => {
    const user = userEvent.setup();
    render(<Field initial={15} isOptional />);
    const duration = screen.getByRole("spinbutton", { name: "Duration" });

    await user.click(screen.getByRole("button", { name: "Shorter" }));
    expect(duration).toHaveAttribute("aria-valuetext", "No duration");
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Longer" }));
    expect(duration).toHaveTextContent("15m");
  });
});
