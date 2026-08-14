/**
 * Portfolio view (`/`) — the screen the walking skeleton is judged on.
 *
 * Composition, not computation: every number rendered below comes straight off
 * `GET /portfolio` / `GET /agents/latest`. This file adds no arithmetic.
 *
 * Each of the three data regions owns its own loading / empty / error state, so
 * one sparse or missing endpoint degrades a single card instead of the page —
 * which is exactly the Sprint 1 situation. A 401 from any of them means the
 * session died mid-visit, so the page bounces to `/login`.
 */
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { isUnauthorized } from "../lib/api";
import type { PortfolioResponse } from "../lib/api";
import {
  useLatestAgentOutput,
  usePortfolio,
  usePortfolioHistory,
  useWatchlist,
} from "../lib/queries";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState, ErrorState, Skeleton, Stale } from "../components/ui/States";
import { KpiRow, KpiRowSkeleton } from "../components/portfolio/KpiRow";
import { PortfolioValueChart } from "../components/portfolio/PortfolioValueChart";
import { PositionsTable } from "../components/portfolio/PositionsTable";
import {
  AgentOutputView,
  NoAgentOutput,
} from "../components/agents/AgentActivityCard";
import { formatTimestamp } from "../lib/format";
import { cn } from "../lib/cn";

export function PortfolioPage() {
  const portfolio = usePortfolio();
  const history = usePortfolioHistory();
  const watchlist = useWatchlist();

  // `undefined` means "not chosen yet" → fall back to the first seeded symbol.
  const [chosenSymbol, setChosenSymbol] = useState<string | undefined>(undefined);
  const symbols = watchlist.data?.map((entry) => entry.symbol) ?? [];
  const symbol = chosenSymbol ?? symbols[0];
  const agent = useLatestAgentOutput(symbol);

  // A 401 anywhere means the session is gone; the guard's job, done here too.
  if (
    isUnauthorized(portfolio.error) ||
    isUnauthorized(agent.error) ||
    isUnauthorized(watchlist.error)
  ) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="enter space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Portfolio</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Paper positions and the committee&rsquo;s latest read.
        </p>
      </div>

      {/* --- KPI row ------------------------------------------------------- */}
      {portfolio.isPending ? (
        <KpiRowSkeleton />
      ) : portfolio.isError ? (
        <ErrorState
          title="Couldn't load your portfolio"
          detail={portfolio.error.message}
          onRetry={() => void portfolio.refetch()}
        />
      ) : portfolio.data ? (
        <Stale isStale={portfolio.isFetching}>
          <KpiRow portfolio={portfolio.data} />
        </Stale>
      ) : (
        <EmptyState
          title="No portfolio snapshot yet"
          detail="Your account doesn't have a portfolio snapshot yet. Cash, equity and P&L will appear here once the first one is written."
        />
      )}

      {/* --- chart + agent activity ---------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Portfolio value over time"
            description="Total equity, as reported by the portfolio service."
          />
          <CardBody>
            {history.isPending ? (
              <Skeleton className="h-[260px] w-full" />
            ) : history.isError ? (
              <EmptyState
                title="No value history yet"
                detail="The portfolio history endpoint isn't available yet. The chart will fill in once daily snapshots start landing."
              />
            ) : (history.data?.length ?? 0) < 2 ? (
              <EmptyState
                title="Not enough history to plot"
                detail="A trend needs at least two snapshots. Come back after the next daily portfolio snapshot."
              />
            ) : (
              <Stale isStale={history.isFetching}>
                <PortfolioValueChart points={history.data ?? []} />
              </Stale>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Agent activity"
            description="Latest technical-analyst output, rendered verbatim."
            actions={
              symbols.length > 0 ? (
                <SymbolSelect
                  symbols={symbols}
                  value={symbol ?? ""}
                  onChange={setChosenSymbol}
                />
              ) : null
            }
          />
          <CardBody>
            {watchlist.isPending || (symbol !== undefined && agent.isPending) ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : symbol === undefined ? (
              <EmptyState
                title="No symbols on the watchlist"
                detail="The watchlist is empty, so there is nothing to analyse yet. Seeded symbols will show up here."
              />
            ) : agent.isError ? (
              <ErrorState
                title="Couldn't load the latest analysis"
                detail={agent.error.message}
                onRetry={() => void agent.refetch()}
              />
            ) : agent.data ? (
              <Stale isStale={agent.isFetching}>
                <AgentOutputView output={agent.data} />
              </Stale>
            ) : (
              <NoAgentOutput symbol={symbol} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* --- positions ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Positions"
          description={
            portfolio.data ? `As of ${formatTimestamp(portfolio.data.asOf)}` : undefined
          }
        />
        <CardBody>
          {portfolio.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : portfolio.isError ? (
            <ErrorState
              title="Couldn't load your positions"
              detail={portfolio.error.message}
              onRetry={() => void portfolio.refetch()}
            />
          ) : (
            <Stale isStale={portfolio.isFetching}>
              <PositionsTable positions={positionsOf(portfolio.data)} />
            </Stale>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function positionsOf(portfolio: PortfolioResponse | null | undefined) {
  return portfolio?.positions ?? [];
}

/**
 * The watchlist selector scopes this one card, so it lives in the card header
 * rather than in a page-level filter row — a page-level control would imply it
 * scopes the portfolio numbers too, which it does not.
 */
function SymbolSelect({
  symbols,
  value,
  onChange,
}: {
  symbols: string[];
  value: string;
  onChange: (symbol: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Watchlist symbol</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "rounded-lg border border-hairline bg-surface-well px-2 py-1",
          "text-xs font-medium text-ink transition-colors duration-150 ease-out",
        )}
      >
        {symbols.map((entry) => (
          <option key={entry} value={entry}>
            {entry}
          </option>
        ))}
      </select>
    </label>
  );
}
