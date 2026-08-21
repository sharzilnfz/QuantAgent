/**
 * Dedicated Agent Configuration & Threshold Tuning Center.
 *
 * Impeccable Operate Mode:
 *  - Interactive parameter controls for specialist agents, consensus policy, and deterministic risk
 *  - Crisp hairline border cards with live slider feedback
 *  - High data density, accessible labels, and instant validation
 */
import { useState, useEffect } from "react";
import type { CommitteeSystemConfig } from "@committee/contracts";
import { useAgentConfig, useUpdateAgentConfig, useResetAgentConfig } from "../lib/queries";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner, Skeleton, ErrorState } from "../components/ui/States";
import { cn } from "../lib/cn";

export function AgentConfigPage() {
  const { data: config, isLoading, error, refetch } = useAgentConfig();
  const updateMutation = useUpdateAgentConfig();
  const resetMutation = useResetAgentConfig();

  const [formState, setFormState] = useState<CommitteeSystemConfig | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setFormState(config);
    }
  }, [config]);

  if (isLoading || !formState) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load agent configuration"
        detail={error instanceof Error ? error.message : String(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formState) return;

    try {
      await updateMutation.mutateAsync(formState);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Handled by mutation error state
    }
  };

  const handleReset = async () => {
    if (window.confirm("Reset all agent thresholds and risk parameters to system defaults?")) {
      const reset = await resetMutation.mutateAsync();
      setFormState(reset);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSave} className="enter space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Agent Committee Configuration</h1>
          <p className="text-sm text-ink-2">
            Configure specialist weights, consensus debate policies, deterministic risk gates, and alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-status-good">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Saved successfully
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={resetMutation.isPending || updateMutation.isPending}
          >
            Reset Defaults
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={() => void handleSave()}
            disabled={updateMutation.isPending || resetMutation.isPending}
          >
            {updateMutation.isPending ? <Spinner className="h-4 w-4" /> : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Section 1: Specialist Agents Roster */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">
          1. Specialist Agent Roster
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Technical Specialist */}
          <SpecialistCard
            title="Technical Analyst Specialist"
            description="Evaluates verified mathematical indicators (Wilder RSI, EMA, Bollinger Bands, MACD)."
            badge="Deterministic L1"
            config={formState.specialists.technical}
            onChange={(updated) =>
              setFormState({
                ...formState,
                specialists: { ...formState.specialists, technical: updated },
              })
            }
          />

          {/* Sentiment Specialist */}
          <SpecialistCard
            title="Sentiment Specialist"
            description="Analyzes timestamped Benzinga news archive strictly bounded by decision timestamp."
            badge="News Archive"
            config={formState.specialists.sentiment}
            onChange={(updated) =>
              setFormState({
                ...formState,
                specialists: { ...formState.specialists, sentiment: updated },
              })
            }
          />

          {/* Fundamental Specialist */}
          <SpecialistCard
            title="Fundamental Specialist"
            description="Evaluates point-in-time SEC EDGAR XBRL corporate financial filings and balance sheets."
            badge="SEC EDGAR"
            config={formState.specialists.fundamental}
            onChange={(updated) =>
              setFormState({
                ...formState,
                specialists: { ...formState.specialists, fundamental: updated },
              })
            }
          />

          {/* Polymarket Specialist */}
          <SpecialistCard
            title="Polymarket Macro Specialist"
            description="Analyzes crowdsourced prediction market probability curves on macroeconomic events."
            badge="Gamma API"
            config={formState.specialists.polymarket}
            onChange={(updated) =>
              setFormState({
                ...formState,
                specialists: { ...formState.specialists, polymarket: updated },
              })
            }
          />
        </div>
      </div>

      {/* Section 2: Deterministic Risk Guardrails & Consensus Policy */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Risk Gate Panel */}
        <Card>
          <CardHeader
            title="Deterministic Risk Gate Guardrails"
            description="Hard constraints enforced by code, never negotiated by an LLM."
          />
          <CardBody className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold">
                <label htmlFor="max-pos" className="text-ink">Max Single-Position Allocation</label>
                <span className="tabular-nums text-ink-2">{formState.risk.maxPositionPct}%</span>
              </div>
              <input
                id="max-pos"
                type="range"
                min="5"
                max="50"
                step="1"
                value={formState.risk.maxPositionPct}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    risk: { ...formState.risk, maxPositionPct: Number(e.target.value) },
                  })
                }
                className="mt-2 w-full accent-ink"
              />
              <p className="mt-1 text-[11px] text-ink-3">Maximum portfolio equity allocated to a single asset.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold">
                <label htmlFor="max-conc" className="text-ink">Max Total Portfolio Concentration</label>
                <span className="tabular-nums text-ink-2">{formState.risk.maxConcentrationPct}%</span>
              </div>
              <input
                id="max-conc"
                type="range"
                min="20"
                max="100"
                step="5"
                value={formState.risk.maxConcentrationPct}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    risk: { ...formState.risk, maxConcentrationPct: Number(e.target.value) },
                  })
                }
                className="mt-2 w-full accent-ink"
              />
              <p className="mt-1 text-[11px] text-ink-3">Total invested capital ceiling before forcing cash preservation.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="stop-loss" className="text-xs font-semibold text-ink">Stop-Loss (%)</label>
                <input
                  id="stop-loss"
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={formState.risk.stopLossPct}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      risk: { ...formState.risk, stopLossPct: Number(e.target.value) },
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs text-ink focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="take-profit" className="text-xs font-semibold text-ink">Take-Profit (%)</label>
                <input
                  id="take-profit"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={formState.risk.takeProfitPct}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      risk: { ...formState.risk, takeProfitPct: Number(e.target.value) },
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs text-ink focus:border-ink focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="approval-threshold" className="text-xs font-semibold text-ink">
                Human Approval Threshold ($)
              </label>
              <input
                id="approval-threshold"
                type="number"
                min="0"
                step="500"
                value={formState.risk.requireApprovalAboveUsd}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    risk: { ...formState.risk, requireApprovalAboveUsd: Number(e.target.value) },
                  })
                }
                className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs text-ink focus:border-ink focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-ink-3">Orders exceeding this estimated cost trigger human review.</p>
            </div>
          </CardBody>
        </Card>

        {/* Consensus & Synthesis Policy */}
        <Card>
          <CardHeader
            title="Consensus & Debate Policy"
            description="Synthesis rules applied when specialists disagree."
          />
          <CardBody className="space-y-4">
            <div>
              <label htmlFor="protocol-select" className="text-xs font-semibold text-ink">Debate Protocol</label>
              <select
                id="protocol-select"
                value={formState.consensus.protocol}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    consensus: {
                      ...formState.consensus,
                      protocol: e.target.value as CommitteeSystemConfig["consensus"]["protocol"],
                    },
                  })
                }
                className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              >
                <option value="majority_fast_pass">Majority Fast-Pass (2-of-3 skips LLM synthesis)</option>
                <option value="single_pass_synthesis">Conditional Single-Pass Synthesis on Disagreement</option>
                <option value="multi_round_critique">Multi-Round Critique Protocol</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold">
                <label htmlFor="agreement-thresh" className="text-ink">Consensus Agreement Threshold</label>
                <span className="tabular-nums text-ink-2">
                  {Math.round(formState.consensus.agreementThreshold * 100)}%
                </span>
              </div>
              <input
                id="agreement-thresh"
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={formState.consensus.agreementThreshold}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    consensus: { ...formState.consensus, agreementThreshold: Number(e.target.value) },
                  })
                }
                className="mt-2 w-full accent-ink"
              />
              <p className="mt-1 text-[11px] text-ink-3">Minimum specialist directional alignment ratio.</p>
            </div>

            <div>
              <label htmlFor="synthesis-model" className="text-xs font-semibold text-ink">Synthesis Model Tier</label>
              <select
                id="synthesis-model"
                value={formState.consensus.synthesisModelTier}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    consensus: {
                      ...formState.consensus,
                      synthesisModelTier: e.target.value as "cheap" | "standard" | "flagship",
                    },
                  })
                }
                className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              >
                <option value="cheap">Cheap Tier (Fast & Economical)</option>
                <option value="standard">Standard Tier (Claude 3.5 Sonnet / GPT-4o)</option>
                <option value="flagship">Flagship Tier (Claude 3.7 Sonnet / Reasoning)</option>
              </select>
            </div>

            {/* Telegram Notification Options */}
            <div className="border-t border-hairline pt-4">
              <h3 className="text-xs font-semibold text-ink">Telegram Bot Alert Preferences</h3>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={formState.telegram.sendTradeAlerts}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        telegram: { ...formState.telegram, sendTradeAlerts: e.target.checked },
                      })
                    }
                    className="rounded border-hairline text-ink"
                  />
                  Real-time Trade Signal Alerts
                </label>
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={formState.telegram.sendEodDigest}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        telegram: { ...formState.telegram, sendEodDigest: e.target.checked },
                      })
                    }
                    className="rounded border-hairline text-ink"
                  />
                  Daily End-of-Day Summary Recap
                </label>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}

function SpecialistCard({
  title,
  description,
  badge,
  config,
  onChange,
}: {
  title: string;
  description: string;
  badge: string;
  config: CommitteeSystemConfig["specialists"]["technical"];
  onChange: (updated: CommitteeSystemConfig["specialists"]["technical"]) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border p-4 transition-colors duration-150",
        config.enabled
          ? "border-hairline bg-surface"
          : "border-hairline/60 bg-surface-well/50 opacity-75",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-3">
            {badge}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-2">{description}</p>
      </div>

      <div className="mt-4 space-y-3 border-t border-hairline pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink">Specialist Active</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            onClick={() => onChange({ ...config, enabled: !config.enabled })}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              config.enabled ? "bg-ink" : "bg-hairline",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out",
                config.enabled ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {config.enabled && (
          <>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-2">Weight Voting Multiplier</span>
                <span className="font-semibold tabular-nums text-ink">{config.weight.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={config.weight}
                onChange={(e) => onChange({ ...config, weight: Number(e.target.value) })}
                className="mt-1.5 w-full accent-ink"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="text-ink-2">Temperature (Sampling)</span>
                <span className="font-semibold tabular-nums text-ink">{config.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={config.temperature}
                onChange={(e) => onChange({ ...config, temperature: Number(e.target.value) })}
                className="mt-1.5 w-full accent-ink"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
