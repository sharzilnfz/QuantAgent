import { useState } from "react";
import {
  useDaemonStatus,
  useStartDaemonMutation,
  useStopDaemonMutation,
  useRunDaemonCycleMutation,
  useUpdateDaemonConfigMutation,
} from "../../lib/queries";
import { Card, CardHeader, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/States";
import { cn } from "../../lib/cn";
import { formatDayShort } from "../../lib/format";

export function DaemonControlCard() {
  const { data: status, isLoading, error, refetch } = useDaemonStatus();
  const startMutation = useStartDaemonMutation();
  const stopMutation = useStopDaemonMutation();
  const runCycleMutation = useRunDaemonCycleMutation();
  const updateConfigMutation = useUpdateDaemonConfigMutation();

  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggle = async () => {
    if (!status) return;
    try {
      if (status.state === "running") {
        await stopMutation.mutateAsync();
        showFeedback("Daemon paused");
      } else {
        await startMutation.mutateAsync();
        showFeedback("Daemon started");
      }
      void refetch();
    } catch (err) {
      showFeedback("Action failed");
    }
  };

  const handleRunNow = async () => {
    try {
      await runCycleMutation.mutateAsync();
      showFeedback("Cycle completed successfully");
      void refetch();
    } catch {
      showFeedback("Cycle failed");
    }
  };

  const handleToggleDryRun = async () => {
    if (!status) return;
    try {
      await updateConfigMutation.mutateAsync({
        dryRun: !status.config.dryRun,
      });
      showFeedback(`Dry-run mode ${!status.config.dryRun ? "enabled" : "disabled"}`);
    } catch {
      showFeedback("Config update failed");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center p-6 text-xs text-ink-3">
          <Spinner className="mr-2 h-4 w-4" /> Loading autonomous trading daemon status…
        </CardBody>
      </Card>
    );
  }

  if (error || !status) {
    return null;
  }

  const isRunning = status.state === "running";
  const isPending =
    startMutation.isPending ||
    stopMutation.isPending ||
    runCycleMutation.isPending ||
    updateConfigMutation.isPending;

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader
        title="Autonomous Trading Daemon (L4/L6)"
        description="Continuous background multi-agent committee deliberation & automated paper execution loop."
        actions={
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-bold uppercase",
                isRunning
                  ? "bg-delta-pos/15 text-delta-pos border border-delta-pos/30"
                  : "bg-surface-well text-ink-3 border border-hairline",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isRunning ? "bg-delta-pos animate-pulse" : "bg-ink-3",
                )}
              />
              {status.state}
            </span>

            <button
              type="button"
              onClick={() => void handleToggleDryRun()}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase border transition-colors",
                status.config.dryRun
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  : "bg-delta-pos/15 text-delta-pos border-delta-pos/30 hover:bg-delta-pos/25",
              )}
              title="Click to toggle dry-run simulation vs real paper order dispatch"
            >
              {status.config.dryRun ? "🛡️ Dry-Run Simulation" : "🚀 Live Paper Execution"}
            </button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {/* Top Control Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-well/50 p-3">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-ink-3">Frequency: </span>
              <strong className="text-ink">Every {status.config.intervalSeconds}s</strong>
            </div>
            <div>
              <span className="text-ink-3">Watchlist: </span>
              <span className="text-ink-2">{status.config.symbols.join(", ")}</span>
            </div>
            <div>
              <span className="text-ink-3">Completed Cycles: </span>
              <span className="text-ink-2">{status.totalCycles}</span>
            </div>
            {status.lastCycleAt && (
              <div>
                <span className="text-ink-3">Last Run: </span>
                <span className="text-ink-2">{formatDayShort(status.lastCycleAt)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {feedback && (
              <span className="text-xs font-medium text-status-good animate-fade-in">
                ✓ {feedback}
              </span>
            )}

            <Button
              variant={isRunning ? "ghost" : "primary"}
              onClick={() => void handleToggle()}
              disabled={isPending}
              className="text-xs"
            >
              {isPending && (startMutation.isPending || stopMutation.isPending) ? (
                <Spinner className="h-3 w-3 mr-1" />
              ) : null}
              {isRunning ? "⏸ Pause Daemon" : "▶ Start Daemon"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => void handleRunNow()}
              disabled={isPending}
              className="text-xs"
            >
              {runCycleMutation.isPending ? (
                <>
                  <Spinner className="h-3 w-3 mr-1" />
                  Running Cycle…
                </>
              ) : (
                "⚡ Run Cycle Now"
              )}
            </Button>
          </div>
        </div>

        {/* Latest Cycle Execution Results */}
        {status.lastCycleResult && status.lastCycleResult.results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span>Latest Automated Deliberation Summary:</span>
              <span className="font-mono text-[10px]">
                Took {status.lastCycleResult.durationMs}ms across {status.lastCycleResult.symbolsEvaluated.length} symbols
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {status.lastCycleResult.results.map((res) => (
                <div
                  key={res.symbol}
                  className="rounded-lg border border-hairline bg-surface p-2.5 font-mono text-xs space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{res.symbol}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                        res.actionTaken === "executed"
                          ? "bg-delta-pos/15 text-delta-pos"
                          : res.actionTaken === "dry_run_recorded"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : res.actionTaken === "rejected_by_risk"
                          ? "bg-delta-neg/15 text-delta-neg"
                          : "bg-surface-well text-ink-3 border border-hairline",
                      )}
                    >
                      {res.actionTaken.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex justify-between text-[10px] text-ink-3">
                    <span>Consensus:</span>
                    <span className="font-semibold text-ink uppercase">
                      {res.consensus.finalBias} ({(res.consensus.finalConfidence * 100).toFixed(0)}%)
                    </span>
                  </div>

                  <div className="flex justify-between text-[10px] text-ink-3">
                    <span>Risk Gate:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        res.riskAssessment.status === "APPROVED"
                          ? "text-delta-pos"
                          : res.riskAssessment.status === "MODIFIED"
                          ? "text-amber-500"
                          : "text-delta-neg",
                      )}
                    >
                      {res.riskAssessment.status}
                    </span>
                  </div>

                  {res.orderResult && (
                    <div className="border-t border-hairline pt-1 text-[10px] text-ink-2">
                      Order: {res.orderResult.side.toUpperCase()} {res.orderResult.qty} shares @ ${res.orderResult.filledAvgPrice ?? "market"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
