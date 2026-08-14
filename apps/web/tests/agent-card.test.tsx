/**
 * Spec 08 §7 — agent card.
 *
 * Direction badge color, confidence meter, verbatim rationale, evidence
 * disclosure. Rendering the agent honestly is the whole point of the card: if
 * the UI paraphrased the rationale or rounded the evidence, a reviewer could no
 * longer check narration against facts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgentOutput } from "@committee/contracts";
import { renderWithProviders } from "./harness";
import {
  AgentOutputView,
  DirectionBadge,
} from "../src/components/agents/AgentActivityCard";
import {
  mockAgentOutput,
  mockBearishOutput,
  mockNeutralOutput,
  mockRationale,
} from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function badgeFor(output: AgentOutput): HTMLElement {
  const { container } = renderWithProviders(<DirectionBadge direction={output.direction} />);
  const badge = container.querySelector<HTMLElement>("[data-direction]");
  if (!badge) throw new Error("direction badge not rendered");
  return badge;
}

describe("direction badge", () => {
  it("colors bullish with the status-good token", () => {
    const badge = badgeFor(mockAgentOutput);
    expect(badge).toHaveAttribute("data-direction", "bullish");
    expect(badge.className).toContain("status-good");
    expect(badge).toHaveTextContent("Bullish");
  });

  it("colors bearish with the status-critical token", () => {
    const badge = badgeFor(mockBearishOutput);
    expect(badge).toHaveAttribute("data-direction", "bearish");
    expect(badge.className).toContain("status-critical");
    expect(badge).toHaveTextContent("Bearish");
  });

  it("colors neutral with the status-neutral token", () => {
    const badge = badgeFor(mockNeutralOutput);
    expect(badge).toHaveAttribute("data-direction", "neutral");
    expect(badge.className).toContain("status-neutral");
    expect(badge).toHaveTextContent("Neutral");
  });

  it("never relies on color alone — the label is always present", () => {
    for (const [output, label] of [
      [mockAgentOutput, "Bullish"],
      [mockBearishOutput, "Bearish"],
      [mockNeutralOutput, "Neutral"],
    ] as const) {
      expect(badgeFor(output)).toHaveTextContent(label);
    }
  });
});

describe("confidence meter", () => {
  it("matches the provided confidence", () => {
    renderWithProviders(<AgentOutputView output={mockAgentOutput} />);

    const meter = screen.getByRole("meter", { name: /confidence/i });
    expect(meter).toHaveAttribute("aria-valuenow", "72");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");

    // The fill is proportional to `confidence` (0.72 -> 72%)...
    expect(screen.getByTestId("confidence-meter-fill")).toHaveStyle({ width: "72%" });
    // ...and the number is also printed, so the value is never gated behind the bar.
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("tracks a different confidence value", () => {
    renderWithProviders(<AgentOutputView output={mockBearishOutput} />);
    expect(screen.getByRole("meter", { name: /confidence/i })).toHaveAttribute(
      "aria-valuenow",
      "31",
    );
    expect(screen.getByTestId("confidence-meter-fill")).toHaveStyle({ width: "31%" });
  });
});

describe("rationale", () => {
  it("appears verbatim — not truncated, not paraphrased", () => {
    renderWithProviders(<AgentOutputView output={mockAgentOutput} />);

    const rationale = screen.getByText(mockRationale);
    expect(rationale).toBeInTheDocument();
    expect(rationale.textContent).toBe(mockAgentOutput.rationale);
  });
});

describe("evidence", () => {
  it("discloses the facts the agent narrated over, unrounded", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AgentOutputView output={mockAgentOutput} />);

    await user.click(screen.getByText(/evidence \(5\)/i));

    const list = container.querySelector("dl");
    expect(list).not.toBeNull();

    for (const [key, value] of Object.entries(mockAgentOutput.evidence)) {
      expect(within(list as HTMLElement).getByText(key)).toBeInTheDocument();
      expect(within(list as HTMLElement).getByText(String(value))).toBeInTheDocument();
    }
    // 61.42 must not have been rounded to 61.4 for display.
    expect(within(list as HTMLElement).getByText("61.42")).toBeInTheDocument();
  });

  it("omits the disclosure entirely when there is no evidence", () => {
    renderWithProviders(<AgentOutputView output={mockNeutralOutput} />);
    expect(screen.queryByText(/evidence \(/i)).not.toBeInTheDocument();
  });
});
