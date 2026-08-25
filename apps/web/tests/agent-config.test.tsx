import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_COMMITTEE_CONFIG } from "@committee/contracts";
import { mockApi, renderWithProviders } from "./harness";
import { mockUser } from "./fixtures";
import { AgentConfigPage } from "../src/routes/AgentConfigPage";

describe("Agent Configuration & Threshold Tuning UI", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders specialist roster cards, risk parameters, and consensus policies", async () => {
    mockApi({
      "/auth/me": { body: mockUser },
      "/agents/config": { body: DEFAULT_COMMITTEE_CONFIG },
    });

    renderWithProviders(<AgentConfigPage />);

    // Check header
    expect(await screen.findByText("Agent Committee Configuration")).toBeInTheDocument();

    // Check specialist cards
    expect(screen.getByText("Technical Analyst Specialist")).toBeInTheDocument();
    expect(screen.getByText("Sentiment Specialist")).toBeInTheDocument();
    expect(screen.getByText("Fundamental Specialist")).toBeInTheDocument();
    expect(screen.getByText("Polymarket Macro Specialist")).toBeInTheDocument();

    // Check risk section
    expect(screen.getByText("Deterministic Risk Gate Guardrails")).toBeInTheDocument();
    expect(screen.getByText("Max Single-Position Allocation")).toBeInTheDocument();
    expect(screen.getByText("Stop-Loss (%)")).toBeInTheDocument();

    // Check consensus section
    expect(screen.getByText("Consensus & Debate Policy")).toBeInTheDocument();
    expect(screen.getByText("Consensus Agreement Threshold")).toBeInTheDocument();
  });

  it("toggles specialist active state and saves configuration changes", async () => {
    let savedConfig: unknown = null;

    mockApi({
      "/auth/me": { body: mockUser },
      "/agents/config": (init) => {
        if (init?.method === "PUT" && init.body) {
          savedConfig = JSON.parse(String(init.body));
          return {
            status: 200,
            body: {
              ...DEFAULT_COMMITTEE_CONFIG,
              ...(savedConfig as Record<string, unknown>),
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return { status: 200, body: DEFAULT_COMMITTEE_CONFIG };
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<AgentConfigPage />);

    expect(await screen.findByText("Agent Committee Configuration")).toBeInTheDocument();

    // Find switches
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(4);

    // Toggle the first specialist (Technical)
    await user.click(switches[0]!);

    // Click Save Changes button
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });

    expect(savedConfig).not.toBeNull();
  });
});
