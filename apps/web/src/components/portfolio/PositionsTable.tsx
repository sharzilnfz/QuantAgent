/**
 * Positions table. Numeric columns are right-aligned and use
 * `font-variant-numeric: tabular-nums` — this is exactly the case tabular
 * figures are for (digits that must line up vertically down a column), as
 * opposed to the stat-tile values, which stay proportional.
 *
 * Every cell prints a value from `GET /portfolio` verbatim; there is no
 * arithmetic in this file. Per-position P&L carries a sign and an arrow so its
 * direction is never color-alone.
 */
import type { PortfolioState } from "@committee/contracts";
import { formatMoney, formatQty, formatSignedMoney } from "../../lib/format";
import { EmptyState } from "../ui/States";
import { TrendArrow } from "./StatTile";
import type { StatTone } from "./StatTile";
import { cn } from "../../lib/cn";

type Position = PortfolioState["positions"][number];

function toneOf(value: number): StatTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

const toneClass: Record<StatTone, string> = {
  neutral: "text-ink",
  positive: "text-delta-pos",
  negative: "text-delta-neg",
};

export function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        icon={<PositionsIcon />}
        title="No open positions"
        detail="Nothing is held yet. Positions will appear here once the execution layer places its first paper trade."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">Open positions</caption>
        <thead>
          <tr className="border-b border-hairline text-xs text-ink-2">
            <th scope="col" className="py-2 pr-3 font-medium">
              Symbol
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Market value
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Unrealized P&L
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const tone = toneOf(position.unrealizedPl);
            return (
              <tr
                key={position.symbol}
                className="border-b border-hairline last:border-b-0 transition-colors duration-150 ease-out [@media(hover:hover)]:hover:bg-surface-well"
              >
                <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                  {position.symbol}
                </th>
                <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                  {formatQty(position.qty)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-ink">
                  {formatMoney(position.marketValue)}
                </td>
                <td className={cn("py-2.5 text-right tabular-nums", toneClass[tone])}>
                  <span className="inline-flex items-center justify-end gap-1">
                    <TrendArrow tone={tone} />
                    {formatSignedMoney(position.unrealizedPl)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PositionsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M3 12h18M3 18h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
