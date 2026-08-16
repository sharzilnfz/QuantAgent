/**
 * Spec 08 §7 — empty states.
 *
 * Sprint 1 data is sparse, so empty is the state most viewers will actually
 * see. It must read as intentional, never as a crash and never as an error.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { mockApi, renderApp, signedInRoutes } from "./harness";
import { mockPortfolioResponse, mockWatchlist } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("null portfolio", () => {
  it("renders an empty state, not an error", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 200, body: null },
        "/portfolio/history": { status: 200, body: [] },
        "/watchlist": { status: 200, body: [] },
      }),
    );

    renderApp("/");

    expect(await screen.findByText(/no portfolio snapshot yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no open positions/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("null agent output", () => {
  it("renders 'no analysis yet', not an error", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 200, body: mockPortfolioResponse },
        "/portfolio/history": { status: 200, body: [] },
        "/watchlist": { status: 200, body: mockWatchlist },
        // No-run is signalled by a 404 (no_runs_for_symbol), not 200 + null.
        "/agents/latest": { status: 404, body: { message: "no_runs_for_symbol" } },
      }),
    );

    renderApp("/");

    expect(await screen.findByText(/no analysis yet/i)).toBeInTheDocument();
    // The card names the symbol it has nothing to say about, so the empty
    // state reads as "nothing for AAPL yet" rather than "something broke".
    expect(screen.getByRole("combobox")).toHaveValue("AAPL");
    expect(screen.getByText(/has not produced an output for AAPL yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("sparse history", () => {
  it("explains that a trend needs two points rather than plotting one", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 200, body: mockPortfolioResponse },
        "/portfolio/history": {
          status: 200,
          body: [{ asOf: "2026-07-21T20:00:00.000Z", equity: 138402.19 }],
        },
        "/watchlist": { status: 200, body: mockWatchlist },
        "/agents/latest": { status: 404, body: { message: "no_runs_for_symbol" } },
      }),
    );

    renderApp("/");

    expect(await screen.findByText(/not enough history to plot/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("degrades to an empty state when the history route does not exist yet", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 200, body: mockPortfolioResponse },
        "/portfolio/history": { status: 404, body: { message: "Not found" } },
        "/watchlist": { status: 200, body: mockWatchlist },
        "/agents/latest": { status: 404, body: { message: "no_runs_for_symbol" } },
      }),
    );

    renderApp("/");

    // The chart degrades; the rest of the dashboard is unaffected.
    expect(await screen.findByText(/no value history yet/i)).toBeInTheDocument();
    expect(screen.getByText("$138,402.19")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("empty watchlist", () => {
  it("says the watchlist is empty instead of showing a broken agent card", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 200, body: mockPortfolioResponse },
        "/portfolio/history": { status: 200, body: [] },
        "/watchlist": { status: 200, body: [] },
      }),
    );

    renderApp("/");

    expect(await screen.findByText(/no symbols on the watchlist/i)).toBeInTheDocument();
  });
});

describe("portfolio error", () => {
  it("shows a recoverable error state rather than crashing", async () => {
    mockApi(
      signedInRoutes({
        "/portfolio": { status: 500, body: { message: "Portfolio service unavailable" } },
        "/portfolio/history": { status: 200, body: [] },
        "/watchlist": { status: 200, body: [] },
      }),
    );

    renderApp("/");

    // The query retries once before giving up, so allow for the backoff.
    expect(
      await screen.findByText(/couldn't load your portfolio/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThan(0);
  });
});
