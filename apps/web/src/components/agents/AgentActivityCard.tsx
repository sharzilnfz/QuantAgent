/**
 * Agent Activity — the honest rendering of one `AgentOutput`.
 *
 * This card is where "facts vs. narration" is visible to a human, so it is
 * deliberately literal:
 *  - `direction` is a badge whose color comes from the FIXED status palette
 *    (good / critical / neutral), never from a categorical series slot — this
 *    color means a state, not an identity. It always ships with an icon AND a
 *    label, so it never depends on hue alone.
 *  - `confidence` is a meter: the accent fill over a LIGHTER STEP OF THE SAME
 *    RAMP, so the level reads across the whole bar. The percentage is also
 *    printed, so the value is never gated behind the visual.
 *  - `rationale` is printed VERBATIM. Not truncated, not clamped, not
 *    summarized, not re-punctuated. `whitespace-pre-line` preserves the model's
 *    own line breaks.
 *  - `evidence` is a disclosure listing the already-computed facts the agent
 *    narrated over, with values printed via `String()` so no formatter can
 *    round a number out from under a reviewer checking narration against facts.
 */
import type { AgentOutput, Direction } from "@committee/contracts";
import { formatConfidence } from "../../lib/format";
import { cn } from "../../lib/cn";
import { EmptyState } from "../ui/States";

interface DirectionStyle {
  label: string;
  /** Tailwind classes bound to the fixed status tokens. */
  className: string;
  path: string;
}

const DIRECTION_STYLES: Record<Direction, DirectionStyle> = {
  bullish: {
    label: "Bullish",
    className: "text-status-good border-status-good",
    path: "M4 16.5 10 10l4 4 6-7.5m0 0h-5m5 0v5",
  },
  bearish: {
    label: "Bearish",
    className: "text-status-critical border-status-critical",
    path: "M4 7.5 10 14l4-4 6 7.5m0 0h-5m5 0v-5",
  },
  neutral: {
    label: "Neutral",
    className: "text-status-neutral border-status-neutral",
    path: "M4 12h16m0 0-4-4m4 4-4 4",
  },
};

export function DirectionBadge({ direction }: { direction: Direction }) {
  const style = DIRECTION_STYLES[direction];
  return (
    <span
      data-direction={direction}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-xs font-semibold",
        style.className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        <path
          d={style.path}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {style.label}
    </span>
  );
}

export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-2">Confidence</span>
        <span className="text-xs font-semibold tabular-nums text-ink">
          {formatConfidence(confidence)}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Confidence"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}%`}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-meter-track"
      >
        <div
          data-testid="confidence-meter-fill"
          className="h-full rounded-full bg-meter-fill transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function EvidenceDisclosure({ evidence }: { evidence: AgentOutput["evidence"] }) {
  const entries = Object.entries(evidence);
  if (entries.length === 0) return null;

  return (
    <details className="group rounded-lg border border-hairline bg-surface-well">
      <summary
        className={cn(
          "flex cursor-pointer select-none items-center gap-1.5 px-3 py-2",
          "text-xs font-medium text-ink-2 transition-colors duration-150 ease-out",
          "[@media(hover:hover)]:hover:text-ink",
        )}
      >
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
        Evidence ({entries.length})
        <span className="ml-auto font-normal text-ink-3">the facts it reasoned over</span>
      </summary>
      <dl className="border-t border-hairline px-3 py-2 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-ink-2">{key}</dt>
            <dd className="tabular-nums text-ink">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function AgentOutputView({ output }: { output: AgentOutput }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DirectionBadge direction={output.direction} />
        <span className="text-xs capitalize text-ink-3">{output.agent} agent</span>
      </div>

      <ConfidenceMeter confidence={output.confidence} />

      {/* Verbatim. Never paraphrased, never truncated. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
        {output.rationale}
      </p>

      <EvidenceDisclosure evidence={output.evidence} />
    </div>
  );
}

export function NoAgentOutput({ symbol }: { symbol?: string }) {
  return (
    <EmptyState
      icon={<AnalysisIcon />}
      title="No analysis yet"
      detail={
        symbol
          ? `The technical agent has not produced an output for ${symbol} yet. It will appear here after the next run.`
          : "The technical agent has not produced an output yet. It will appear here after the next run."
      }
    />
  );
}

function AnalysisIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4 18 9 12l3.5 3.5L20 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
