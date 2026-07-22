/**
 * Portfolio value over time.
 *
 * dataviz decisions, in the order the skill prescribes:
 *  1. FORM — the job is "trend over time" for ONE series, so: a line with an
 *     area wash. Not a bar chart, not a dual axis (there is exactly one y-scale
 *     here and there will never be a second one on this plot).
 *  2. COLOR — one series means categorical slot 1 and nothing else:
 *     `--series-1` (#2a78d6 light / #3987e5 dark, both validated). The area is
 *     that same hue at ~10% opacity — a wash, never a saturated block.
 *  3. VALIDATED — `validate_palette.js` run for both modes against the real
 *     surfaces (#fcfcfb / #1a1a19): lightness band, chroma floor, CVD
 *     separation, normal-vision floor and contrast all PASS.
 *  4. MARKS — 2px stroke with round join/cap; active dot r=4 (8px) carrying a
 *     2px ring in the surface color so it stays legible over the line;
 *     horizontal-only gridlines, SOLID hairlines one step off the surface
 *     (never dashed); no marker on every point.
 *  5. HOVER — a crosshair hairline snaps to the nearest x so the reader aims at
 *     a date, not at a 2px line; the tooltip leads with the value and follows
 *     with the date, keyed by a short stroke of the series color.
 *  6. ACCESSIBILITY — a single series needs no legend box (the card title names
 *     what is plotted), and the chart ships a table-view twin so no value is
 *     reachable *only* by hovering.
 *
 * The component performs no arithmetic on `points` — it plots the equity values
 * the API computed, formatted for display only.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioPoint } from "../../lib/api";
import { formatDate, formatDayShort, formatMoney, formatMoneyCompact } from "../../lib/format";

const PLOT_HEIGHT = 260;

interface TooltipEntry {
  payload?: PortfolioPoint;
}

/**
 * Value leads, label follows — the legend hierarchy inverted, because here the
 * reader already has the series and wants the number. The series is keyed with
 * a short stroke, not a filled box.
 */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-0.5 w-3.5 rounded-full bg-series"
        />
        <span className="text-sm font-semibold tabular-nums text-ink">
          {formatMoney(point.equity)}
        </span>
      </div>
      <p className="mt-0.5 pl-[22px] text-xs text-ink-2">{formatDate(point.asOf)}</p>
    </div>
  );
}

export function PortfolioValueChart({ points }: { points: PortfolioPoint[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  const range =
    first && last && points.length > 1
      ? `${formatDate(first.asOf)} – ${formatDate(last.asOf)}`
      : undefined;

  return (
    <div>
      {/*
        The container is sized to the plot PLUS the x-axis band, so the axis
        labels are never squeezed into a nested scrollbar.
      */}
      <div style={{ height: PLOT_HEIGHT }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="equity-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Horizontal only, solid hairline, recessive. */}
            <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />

            <XAxis
              dataKey="asOf"
              tickFormatter={formatDayShort}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              tick={{ fill: "var(--ink-3)", fontSize: 11 }}
              minTickGap={28}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              tickFormatter={formatMoneyCompact}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--ink-3)", fontSize: 11 }}
              width={64}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<ChartTooltip />}
              // The crosshair: a hairline that snaps to the nearest x.
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              name="Portfolio value"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#equity-wash)"
              // No dot on every point; only the hovered one, ringed in the
              // surface color so it reads over the line.
              dot={false}
              activeDot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/*
        The table-view twin. A tooltip must never be the ONLY way to read a
        value: this is the WCAG-clean equivalent, and it is what keyboard and
        screen-reader users (and our jsdom tests) read instead of the SVG.
      */}
      <details className="mt-3 group">
        <summary
          className={
            "inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-1 " +
            "text-xs font-medium text-ink-2 transition-colors duration-150 ease-out " +
            "[@media(hover:hover)]:hover:text-ink"
          }
        >
          <Chevron />
          View as table
        </summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-hairline">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Portfolio value over time{range ? `, ${range}` : ""}
            </caption>
            <thead className="sticky top-0 bg-surface-well text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Portfolio value
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.asOf} className="border-t border-hairline">
                  <td className="px-3 py-1.5 text-ink-2">{formatDate(point.asOf)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                    {formatMoney(point.equity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-open:rotate-90"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
