/**
 * Display formatting ONLY.
 *
 * Cross-cutting law #2 (facts vs. narration): the UI never *computes* a
 * financial number. Nothing in this file adds, subtracts, aggregates, or
 * derives a value — every function takes a number the API already computed and
 * decides how to print it. `confidence` is the one scaling here (0–1 → 0–100%),
 * which is a unit change on a dimensionless score, not portfolio arithmetic.
 */

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const quantity = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

/** `1234.5` → `$1,234.50`. */
export function formatMoney(value: number): string {
  return money.format(value);
}

/**
 * `1234.5` → `+$1,234.50` / `-$1,234.50`. The explicit sign is a second,
 * non-color channel for direction — the delta color never carries it alone.
 */
export function formatSignedMoney(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${money.format(Math.abs(value))}`;
}

/** Axis ticks: `1234.5` → `$1.2K`. Compact so ticks stay on clean numbers. */
export function formatMoneyCompact(value: number): string {
  return moneyCompact.format(value);
}

/** Share counts. `12.5` → `12.5`, `100` → `100`. */
export function formatQty(value: number): string {
  return quantity.format(value);
}

/** Agent confidence: `0.72` → `72%`. Rounds for display only. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** ISO timestamp → `Mar 14, 2025, 4:00 PM`. Invalid input passes through. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ISO timestamp → `Mar 14`. Used for x-axis ticks. */
export function formatDayShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ISO timestamp → `Mar 14, 2025`. Used in the chart's table view + tooltip. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
