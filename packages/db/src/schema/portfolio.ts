import {
  pgTable,
  uuid,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export type PortfolioPositionSnapshot = {
  symbol: string;
  qty: number;
  marketValue: number;
  unrealizedPl: number;
};

/**
 * L6 Execution & Portfolio State: Point-in-time portfolio equity & position snapshots.
 *
 * Every snapshot carries:
 *   - `user_id` — the account owner.
 *   - `cash` / `equity` — total available cash and aggregate account equity.
 *   - `positions` — JSON array of open positions with mark-to-market valuations.
 *   - `as_of` — the exact point-in-time timestamp when this valuation became effective.
 *
 * Indexed on `(user_id, as_of)` for fast time-series queries.
 */
export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cash: numeric("cash").notNull(),
    equity: numeric("equity").notNull(),
    positions: jsonb("positions")
      .$type<PortfolioPositionSnapshot[]>()
      .notNull()
      .default([]),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("portfolio_snapshots_user_as_of_idx").on(t.userId, t.asOf),
    index("portfolio_snapshots_as_of_idx").on(t.asOf),
  ],
);
