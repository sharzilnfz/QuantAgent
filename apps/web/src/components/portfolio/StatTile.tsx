/**
 * Stat tile — the right form for "a handful of headline numbers". Three of
 * these beat a grouped bar chart of cash vs. equity vs. P&L, which would be a
 * chart doing a number's job.
 *
 * Tile contract (dataviz): `label` in sentence case with no trailing colon,
 * `value` in the system sans at semibold, optional `note` for the as-of line.
 * Values use the font's DEFAULT proportional figures — `tabular-nums` gives
 * every digit the width of a `0`, which makes a large standalone number look
 * loose. Tabular figures are reserved for the positions table's columns.
 *
 * `tone` colors the value for P&L direction. It is never the only channel: the
 * formatter always prints an explicit +/- sign and a direction arrow rides
 * beside the number, so the meaning survives greyscale and CVD.
 */
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { cn } from "../../lib/cn";
import { Skeleton } from "../ui/States";

export type StatTone = "neutral" | "positive" | "negative";

const toneClass: Record<StatTone, string> = {
  neutral: "text-ink",
  positive: "text-delta-pos",
  negative: "text-delta-neg",
};

export function StatTile({
  label,
  value,
  note,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  return (
    <Card as="div" className="p-5">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={cn("mt-2 flex items-baseline gap-1.5 text-3xl font-semibold tracking-tight", toneClass[tone])}>
        {icon}
        <span>{value}</span>
      </p>
      {note ? <p className="mt-1.5 text-xs text-ink-3">{note}</p> : null}
    </Card>
  );
}

/** First-load placeholder. Same box, same rhythm — nothing shifts on resolve. */
export function StatTileSkeleton({ label }: { label: string }) {
  return (
    <Card as="div" className="p-5">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <Skeleton className="mt-2 h-9 w-32" />
      <Skeleton className="mt-2 h-3 w-24" />
    </Card>
  );
}

/** Arrow that rides beside a signed value — the non-color direction channel. */
export function TrendArrow({ tone }: { tone: StatTone }) {
  if (tone === "neutral") return null;
  const up = tone === "positive";
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 self-center"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={up ? "M12 19V5m0 0-6 6m6-6 6 6" : "M12 5v14m0 0 6-6m-6 6-6-6"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
