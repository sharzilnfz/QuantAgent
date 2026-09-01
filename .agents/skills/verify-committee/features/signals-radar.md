# Live Signals and Indicator Radar

The Live Signals and Indicator Radar provides real-time technical indicators, specialist agent stances, consensus resolution gauges, and on-demand deliberation evaluation triggers.

## Sub-features

- `signals-indicator-gauges` computes and renders Wilder 14-day RSI, MACD (12/26/9), Bollinger Bands (20, 2σ), and SMA (20/50) ribbons.
- `signals-stance-matrix` displays live stances (bullish, bearish, neutral) and confidence scores for Technical, Sentiment, Fundamental, and Polymarket agents.
- `signals-consensus-preview` shows composite bias and confidence alongside deterministic risk gate checks.
- `signals-evaluate-action` triggers immediate on-demand agent evaluation for a selected ticker.

## How to get to it (user POV)

- Choose `Signals` (`/signals`) in the primary sidebar navigation.

## Driving it with Playwright

Preconditions:
- User is authenticated as `demo@committee.local`.
- Web UI is running at `http://localhost:5173`.
- API server is running at `http://localhost:3000`.

- **Open Signals Radar.** Click the sidebar link. Run `browser_click` with `target: "a[href='/signals']"`. The page heading reads `Live Signals & Indicator Radar`.
- **Select Symbol.** Click `NVDA` or `SPY` in the symbol selector tabs. Run `browser_click` with `target: "button:has-text('NVDA')"`. The indicator cards and specialist table update with NVDA market data.
- **Inspect Indicator Values.** Observe Wilder RSI (14), MACD histogram, Bollinger Band range, and SMA 20/50 levels.
- **Trigger On-Demand Evaluation.** Click the `⚡ Evaluate Now` button. Run `browser_click` with `target: "button:has-text('Evaluate Now')"`. The button enters loading state, dispatches deliberation, and displays `✓ Evaluated successfully` with updated stance outputs.
- **Capture proof.** Run `browser_take_screenshot` to `artifacts/verify-committee/signals.png` and `browser_snapshot` to `artifacts/verify-committee/signals.snapshot.yml`.

## Gotchas

- Calling the evaluation endpoint requires active session authorization.
- Warm-up periods: If historical bar history is shorter than indicator window requirements (e.g. 50 bars for SMA50), the indicator gracefully reports null / warming up.
- Live market streaming automatically reconnects if the WebSocket or SSE connection drops.
