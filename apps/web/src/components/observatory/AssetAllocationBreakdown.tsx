/**
 * AssetAllocationBreakdown: Displays multi-asset portfolio weights, cash reserve balance,
 * and per-asset trade/turnover telemetry in Impeccable Operate Mode.
 */
import type { MultiAssetExperimentManifest } from "@committee/contracts";

interface AssetAllocationBreakdownProps {
  manifest?: MultiAssetExperimentManifest;
}

export function AssetAllocationBreakdown({ manifest }: AssetAllocationBreakdownProps) {
  if (!manifest) return null;

  const latestPoint = manifest.equityCurve[manifest.equityCurve.length - 1];
  const positions = latestPoint?.positions ?? {};
  const symbols = manifest.symbols;
  const cashWeight = latestPoint?.cashWeight ?? 1.0;
  const totalEquity = latestPoint?.totalEquity ?? manifest.metrics.finalEquity;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink flex items-center gap-2">
            <span className="text-series">🌐</span>
            <span>Cross-Asset Capital Allocation & Universe Breakdown</span>
          </h3>
          <p className="text-xs text-ink-2 mt-0.5">
            Dynamic capital distribution across universe assets with 5% risk cash reserve.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-ink-3">Total Portfolio Equity:</span>
          <span className="font-bold text-ink">
            ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Allocation Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-ink-2">
          <span>Active Asset Exposure</span>
          <span className="font-mono">{( (1.0 - cashWeight) * 100).toFixed(1)}% Invested / {(cashWeight * 100).toFixed(1)}% Cash</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-well border border-hairline">
          {symbols.map((sym, i) => {
            const pos = positions[sym];
            const weight = pos?.weight ?? 0;
            if (weight <= 0) return null;
            const colors = ["bg-series", "bg-delta-pos", "bg-series-debate-on", "bg-series-polymarket"];
            const bgClass = colors[i % colors.length]!;

            return (
              <div
                key={sym}
                style={{ width: `${(weight * 100).toFixed(1)}%` }}
                className={`${bgClass} transition-all duration-300 relative group`}
                title={`${sym}: ${(weight * 100).toFixed(1)}% ($${pos?.marketValue.toLocaleString()})`}
              />
            );
          })}
          {cashWeight > 0.001 && (
            <div
              style={{ width: `${(cashWeight * 100).toFixed(1)}%` }}
              className="bg-hairline/60 transition-all duration-300"
              title={`Cash Reserve: ${(cashWeight * 100).toFixed(1)}% ($${latestPoint?.cash.toLocaleString()})`}
            />
          )}
        </div>
      </div>

      {/* Per-Asset Details Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-hairline text-ink-3">
              <th className="py-2 px-3 font-medium">Asset Symbol</th>
              <th className="py-2 px-3 font-medium text-right">Holding Shares</th>
              <th className="py-2 px-3 font-medium text-right">Latest Price</th>
              <th className="py-2 px-3 font-medium text-right">Market Value</th>
              <th className="py-2 px-3 font-medium text-right">Portfolio Weight</th>
              <th className="py-2 px-3 font-medium text-right">Turnover (NAV)</th>
              <th className="py-2 px-3 font-medium text-right">Trades Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline font-mono">
            {symbols.map((sym) => {
              const pos = positions[sym];
              const shares = pos?.shares ?? 0;
              const price = pos?.price ?? 0;
              const marketValue = pos?.marketValue ?? 0;
              const weight = pos?.weight ?? 0;
              const turnover = manifest.perAssetTurnover?.[sym] ?? 0;
              const tradeCount = manifest.perAssetTradeCount?.[sym] ?? 0;

              return (
                <tr key={sym} className="hover:bg-surface-well/50 transition-colors">
                  <td className="py-2 px-3 font-bold text-ink flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-series" />
                    <span>{sym}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-ink">{shares.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-ink-2">${price.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-medium text-ink">
                    ${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right text-series font-bold">
                    {(weight * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 px-3 text-right text-ink-2">{(turnover * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right text-ink-2">{tradeCount}</td>
                </tr>
              );
            })}
            {/* Cash Row */}
            <tr className="bg-surface-well/30">
              <td className="py-2 px-3 font-bold text-ink-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ink-3" />
                <span>USD (Cash Buffer)</span>
              </td>
              <td className="py-2 px-3 text-right text-ink-3">—</td>
              <td className="py-2 px-3 text-right text-ink-3">$1.00</td>
              <td className="py-2 px-3 text-right font-medium text-ink-2">
                ${(latestPoint?.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-2 px-3 text-right text-ink-2 font-bold">
                {(cashWeight * 100).toFixed(1)}%
              </td>
              <td className="py-2 px-3 text-right text-ink-3">—</td>
              <td className="py-2 px-3 text-right text-ink-3">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
