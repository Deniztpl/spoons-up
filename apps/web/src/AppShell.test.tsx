import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

const onLogout = vi.fn(async () => ({ ok: true as const }));

describe("App shell", () => {
  it("renders the header, areas sidebar, and main welcome panel", () => {
    render(<AppShell onLogout={onLogout} />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Spoons Up")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Areas" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Welcome to Spoons Up" }),
    ).toBeInTheDocument();
  });

  it("opens and closes the mobile areas drawer with focus management", async () => {
    const user = userEvent.setup();
    render(<AppShell onLogout={onLogout} />);
    const menuButton = screen.getByRole("button", { name: "Open areas menu" });

    await user.click(menuButton);

    const drawer = screen.getByRole("dialog", { name: "Areas" });
    const closeButton = screen.getByRole("button", { name: "Close areas menu" });
    expect(drawer).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Areas" })).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveFocus();

    await user.click(menuButton);
    await user.click(screen.getByRole("button", { name: "Close areas menu" }));
    expect(screen.queryByRole("dialog", { name: "Areas" })).not.toBeInTheDocument();
  });
});
