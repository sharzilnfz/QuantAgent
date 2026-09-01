# Decision Lineage Inspector

The Decision Lineage Inspector provides full decision provenance auditing, step-by-step specialist deliberation transcripts, raw prompt and completion inspection, and temporal correctness verification.

## Sub-features

- `lineage-timeline-navigation` steps through historical trading dates using keyboard arrow keys (`ArrowLeft`, `ArrowRight`) or date selection.
- `lineage-point-in-time-audit` displays exact OHLCV bar, indicator snapshots, news headlines, and SEC XBRL financial statements available at `as_of <= T_decision`.
- `lineage-debate-transcript` displays multi-round structured debate between Technical, Sentiment, and Fundamental agents.
- `lineage-prompt-inspector` reveals raw system prompts, rendered user context, and model completions with one-click clipboard copying.
- `lineage-risk-audit` inspects deterministic risk gate evaluations (circuit breaker, max exposure, cash reserve checks).

## How to get to it (user POV)

- Choose `Lineage` (`/lineage`) in the primary sidebar navigation.
- Or click any `📜 Audit Lineage` button from the Observatory page.

## Driving it with Playwright

Preconditions:
- User is authenticated as `demo@committee.local`.
- Web UI is running at `http://localhost:5173`.
- API server is running at `http://localhost:3000`.

- **Open Lineage view.** Click sidebar link. Run `browser_click` with `target: "a[href='/lineage']"`. The page heading reads `Decision Provenance & Multi-Agent Lineage Inspector`.
- **Step timeline.** Press `ArrowLeft` / `ArrowRight` to navigate between historical decision dates. Run `browser_press_key` with `key: "ArrowLeft"`. The active decision timestamp and bar data update immediately.
- **Inspect Inputs Tab.** Click the `Inputs & Data` tab. Run `browser_click` with `target: "button:has-text('Inputs & Data')"`. Observe point-in-time OHLCV bar values and indicator inputs.
- **Inspect Specialist Debate.** Click the `Multi-Agent Debate` tab. Run `browser_click` with `target: "button:has-text('Multi-Agent Debate')"`. Observe specialist deliberation cards (Technical stance, Sentiment stance, Fundamental stance) and final consensus bias.
- **Inspect Prompts Tab.** Click the `Prompts & Completions` tab. Run `browser_click` with `target: "button:has-text('Prompts & Completions')"`. Observe raw system prompts and model completion payloads.
- **Capture proof.** Run `browser_take_screenshot` to `artifacts/verify-committee/lineage.png` and `browser_snapshot` to `artifacts/verify-committee/lineage.snapshot.yml`.

## Gotchas

- When viewing historical decisions, all data sources must strictly obey point-in-time filtering (`as_of <= T_decision`); forward-looking indicators will trigger a `TemporalIntegrityViolation`.
- Keyboard arrow navigation is ignored when typing inside text inputs.
- If a strategy has no recorded debate rounds (e.g. single baseline strategies), the debate tab displays an empty state indicating single-pass execution.
