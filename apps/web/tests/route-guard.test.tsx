/**
 * Spec 08 §7 — route guard, session persistence, logout.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockApi, renderApp, signedInRoutes } from "./harness";
import { mockPortfolioResponse, mockHistory, mockWatchlist, mockAgentOutput } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const dashboardRoutes = {
  "/portfolio": { status: 200, body: mockPortfolioResponse },
  "/portfolio/history": { status: 200, body: mockHistory },
  "/watchlist": { status: 200, body: mockWatchlist },
  "/agents/latest": { status: 200, body: mockAgentOutput },
};

describe("route guard", () => {
  it("redirects a protected route to /login when GET /auth/me is 401", async () => {
    mockApi({ "/auth/me": { status: 401, body: { message: "Unauthorized" } } });

    renderApp("/");

    // The login screen is what a bounced visitor lands on.
    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // ...and the dashboard is not rendered behind it.
    expect(screen.queryByRole("heading", { name: /^portfolio$/i })).not.toBeInTheDocument();
  });

  it("never requests protected data once /auth/me has 401'd", async () => {
    const api = mockApi({ "/auth/me": { status: 401, body: { message: "Unauthorized" } } });

    renderApp("/");
    await screen.findByRole("heading", { name: /sign in/i });

    expect(api.calls).toContain("/auth/me");
    expect(api.calls.some((path) => path.startsWith("/portfolio"))).toBe(false);
  });

  it("restores the session on boot when GET /auth/me is 200 (survives a reload)", async () => {
    mockApi(signedInRoutes(dashboardRoutes));

    renderApp("/");

    expect(await screen.findByRole("heading", { name: /^portfolio$/i })).toBeInTheDocument();
    expect(screen.getByText("analyst@committee.test")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
  });
});

describe("login", () => {
  it("lands on the dashboard after a successful POST /auth/login", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "/auth/me": { status: 401, body: { message: "Unauthorized" } },
      "/auth/login": { status: 200, body: { user: { id: "usr_01HZX", email: "analyst@committee.test" } } },
      ...dashboardRoutes,
    });

    renderApp("/");
    await screen.findByRole("heading", { name: /sign in/i });

    await user.type(screen.getByLabelText(/email/i), "analyst@committee.test");
    await user.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("heading", { name: /^portfolio$/i })).toBeInTheDocument();
    expect(api.calls).toContain("/auth/login");
  });

  it("surfaces a rejected login instead of silently failing", async () => {
    const user = userEvent.setup();
    mockApi({
      "/auth/me": { status: 401, body: { message: "Unauthorized" } },
      "/auth/login": { status: 401, body: { message: "Invalid email or password." } },
    });

    renderApp("/");
    await screen.findByRole("heading", { name: /sign in/i });

    await user.type(screen.getByLabelText(/email/i), "analyst@committee.test");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
  });
});

describe("logout", () => {
  it("clears the session and returns to /login", async () => {
    const user = userEvent.setup();
    const api = mockApi(
      signedInRoutes({ ...dashboardRoutes, "/auth/logout": { status: 204 } }),
    );

    renderApp("/");
    await screen.findByRole("heading", { name: /^portfolio$/i });

    // The server drops the session; the next /auth/me must fail.
    api.set("/auth/me", { status: 401, body: { message: "Unauthorized" } });
    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    });
    expect(api.calls).toContain("/auth/logout");
  });
});
