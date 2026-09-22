import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AreasPage } from "./AreasPage";

const onLogout = vi.fn(async () => ({ ok: true as const }));
const createdAt = "2026-09-22T09:00:00Z";

function area(id: string, name: string) {
  return { id, name, archived_at: null, created_at: createdAt };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/areas"]}>
      <AreasPage onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("Areas page", () => {
  beforeEach(() => {
    onLogout.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ areas: [] })),
    );
  });

  it("renders domain selection, page navigation, and area management in main", async () => {
    renderPage();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Spoons Up")).toBeInTheDocument();
    const domainSelect = screen.getByRole("combobox", { name: "Domain" });
    expect(domainSelect).toHaveValue("goals-and-habits");
    expect(
      screen.getByRole("option", { name: "Nutrition — Coming soon" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Fitness — Coming soon" }),
    ).toBeDisabled();

    const sidebar = screen.getByRole("complementary", { name: "Page navigation" });
    expect(within(sidebar).getByRole("link", { name: "Areas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(sidebar).getByRole("button", { name: /Today/ })).toBeDisabled();
    expect(within(sidebar).getByRole("button", { name: /Week/ })).toBeDisabled();
    expect(within(sidebar).queryByRole("button", { name: "Add area" })).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Create your first area" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("button", { name: "Add area" }),
    ).toBeInTheDocument();
  });

  it("loads, selects, creates, and renames areas", async () => {
    const fetchMock = vi.fn(async (request: Request) => {
      const pathname = new URL(request.url).pathname;
      if (request.method === "GET" && pathname === "/api/v1/areas") {
        return Response.json({ areas: [area("1", "SWE"), area("2", "Finance")] });
      }
      if (request.method === "POST" && pathname === "/api/v1/areas") {
        expect(await request.clone().json()).toEqual({ name: "Social" });
        return Response.json(area("3", "Social"), { status: 201 });
      }
      if (request.method === "PATCH" && pathname === "/api/v1/areas/3") {
        expect(await request.clone().json()).toEqual({ name: "Community" });
        return Response.json(area("3", "Community"));
      }
      throw new Error(`Unexpected request: ${request.method} ${pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "SWE" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finance" }));
    expect(screen.getByRole("heading", { name: "Finance" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add area" }));
    await user.type(screen.getByLabelText("Area name"), "Social");
    await user.click(screen.getByRole("button", { name: "Create area" }));
    expect(await screen.findByRole("heading", { name: "Social" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByLabelText("Area name");
    await user.clear(renameInput);
    await user.type(renameInput, "Community");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Community" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Community" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("opens and closes the narrow-screen navigation drawer with focus management", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "Create your first area" });
    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });

    await user.click(menuButton);

    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    expect(drawer).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Navigation" }),
      ).not.toBeInTheDocument();
    });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveFocus();
  });
});
