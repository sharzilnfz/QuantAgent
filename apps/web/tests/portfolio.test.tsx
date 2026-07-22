/**
 * Spec 08 §7 — portfolio render.
 *
 * The load-bearing assertion in this file: every displayed number equals the
 * mock. The UI formats for display but must never transform, aggregate, or
 * recompute a value (cross-cutting law #2 — the UI renders already-computed
 * facts). The aggregate P&L fixture is deliberately NOT the sum of the two
 * positions, so a UI that "helpfully" summed them would fail here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { mockApi, renderApp, signedInRoutes } from "./harness";
import {
  mockAgentOutput,
  mockHistory,
  mockPortfolio,
  mockPortfolioResponse,
  mockWatchlist,
} from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDashboard() {
  mockApi(
    signedInRoutes({
      "/portfolio": { status: 200, body: mockPortfolioResponse },
      "/portfolio/history": { status: 200, body: mockHistory },
      "/watchlist": { status: 200, body: mockWatchlist },
      "/agents/latest": { status: 200, body: mockAgentOutput },
    }),
  );
  return renderApp("/");
}

describe("KPI tiles", () => {
  it("renders cash, equity and P&L exactly as provided", async () => {
    renderDashboard();
    await screen.findByText("$24,180.42");

    // Scoped to the KPI row: the same equity figure also legitimately appears
    // as the last point of the chart's table view.
    const kpis = within(screen.getByRole("region", { name: /key figures/i }));

    // cash: 24180.42 · equity: 138402.19 · aggregate P&L: 902.40
    expect(kpis.getByText("$24,180.42")).toBeInTheDocument();
    expect(kpis.getByText("$138,402.19")).toBeInTheDocument();
    expect(kpis.getByText("+$902.40")).toBeInTheDocument();
  });

  it("does not sum the positions to invent an aggregate P&L", async () => {
    renderDashboard();
    await screen.findByText("$24,180.42");

    const summed =
      mockPortfolio.positions[0]!.unrealizedPl + mockPortfolio.positions[1]!.unrealizedPl;
    expect(summed).not.toBe(mockPortfolioResponse.unrealizedPl);
    expect(screen.queryByText("+$825.35")).not.toBeInTheDocument();
  });
});

describe("positions table", () => {
  it("renders one row per position with the provided values", async () => {
    renderDashboard();
    const table = await screen.findByRole("table", { name: /open positions/i });

    const rows = within(table).getAllByRole("row");
    // header + 2 positions
    expect(rows).toHaveLength(3);

    const aapl = within(table).getByRole("row", { name: /AAPL/ });
    expect(within(aapl).getByText("120")).toBeInTheDocument();
    expect(within(aapl).getByText("$21,744.00")).toBeInTheDocument();
    expect(within(aapl).getByText("+$1,312.55")).toBeInTheDocument();

    const msft = within(table).getByRole("row", { name: /MSFT/ });
    expect(within(msft).getByText("40")).toBeInTheDocument();
    expect(within(msft).getByText("$16,902.80")).toBeInTheDocument();
    expect(within(msft).getByText("-$487.20")).toBeInTheDocument();
  });
});

describe("value-over-time chart", () => {
  it("plots every provided point, readable without hovering", async () => {
    renderDashboard();
    // The chart's table-view twin carries the same series the plot draws — and
    // it is the accessible, non-hover path to those values.
    const table = await screen.findByRole("table", { name: /portfolio value over time/i });

    for (const point of mockHistory) {
      expect(
        within(table).getByText(
          point.equity.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
          }),
        ),
      ).toBeInTheDocument();
    }

    // header row + one row per point
    expect(within(table).getAllByRole("row")).toHaveLength(mockHistory.length + 1);
  });
});
