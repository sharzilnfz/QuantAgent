/**
 * The KPI row: cash, equity, unrealized P&L.
 *
 * Every number here is printed straight from `GET /portfolio` — this component
 * contains no arithmetic at all (cross-cutting law #2). The P&L tile is the
 * one place that shows through: `PortfolioState` has no aggregate P&L field, so
 * when the API doesn't supply one the tile says "not reported" rather than
 * summing `positions[].unrealizedPl` in the browser. See CONTRACT GAPS in
 * `lib/api.ts`.
 */
import type { PortfolioResponse } from "../../lib/api";
import { formatMoney, formatSignedMoney, formatTimestamp } from "../../lib/format";
import { StatTile, StatTileSkeleton, TrendArrow } from "./StatTile";
import type { StatTone } from "./StatTile";

const TILE_LABELS = ["Cash", "Equity", "Unrealized P&L"] as const;

/**
 * The row is a labelled region: it gives assistive tech (and tests) a way to
 * address "the headline figures" as a unit, distinct from the same numbers
 * appearing in the chart's table view further down.
 */
const ROW_CLASS = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
const ROW_LABEL = "Key figures";

export function KpiRowSkeleton() {
  return (
    <section aria-label={ROW_LABEL} className={ROW_CLASS}>
      {TILE_LABELS.map((label) => (
        <StatTileSkeleton key={label} label={label} />
      ))}
    </section>
  );
}

export function KpiRow({ portfolio }: { portfolio: PortfolioResponse }) {
  const asOf = `As of ${formatTimestamp(portfolio.asOf)}`;
  const pl = portfolio.unrealizedPl;
  const tone: StatTone = pl === undefined || pl === 0 ? "neutral" : pl > 0 ? "positive" : "negative";

  return (
    <section aria-label={ROW_LABEL} className={ROW_CLASS}>
      <StatTile label="Cash" value={formatMoney(portfolio.cash)} note={asOf} />
      <StatTile label="Equity" value={formatMoney(portfolio.equity)} note={asOf} />
      {pl === undefined ? (
        <StatTile
          label="Unrealized P&L"
          value={<span className="text-ink-3">Not reported</span>}
          note="The portfolio endpoint does not return an aggregate P&L yet. Per-position P&L is in the table below."
        />
      ) : (
        <StatTile
          label="Unrealized P&L"
          value={formatSignedMoney(pl)}
          tone={tone}
          icon={<TrendArrow tone={tone} />}
          note={asOf}
        />
      )}
    </section>
  );
}
