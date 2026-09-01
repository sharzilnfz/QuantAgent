# Evaluation Observatory

The Evaluation Observatory provides an interactive backtest evaluation suite, multi-series equity curves with ablation overlays, and side-by-side performance tearsheets across specialist agent configurations and benchmark strategies.

## Sub-features

- `observatory-dataset-select` switches between single-asset fixtures (`AAPL`, `NVDA`, `SPY`) and the cross-asset `Universe (AAPL+NVDA+SPY)` basket.
- `observatory-strategy-overlay` dynamically toggles strategy curves (`Buy & Hold`, `SMA/RSI`, `Multi-Agent Debate ON`, `Multi-Agent Debate OFF`, `Polymarket`).
- `observatory-equity-chart` displays synchronized time-series growth curves and drawdown profiles.
- `observatory-tearsheet` renders financial metrics (Total Return, Annualized Return, Sharpe Ratio, Sortino Ratio, Max Drawdown, Win Rate, Directional Accuracy, Brier Score).
- `observatory-telemetry` verifies offline zero-credential execution, showing dataset SHA256, Git commit, runtime duration, and $0.00 token cost.

## How to get to it (user POV)

- Choose `Observatory` (`/observatory`) in the primary sidebar navigation.
- Or click the `Observatory` link from the dashboard header.

## Driving it with Playwright

Preconditions:
- User is authenticated as `demo@committee.local`.
- Web UI is running at `http://localhost:5173`.
- API server is running at `http://localhost:3000`.

- **Open Observatory.** Click the sidebar link. Run `browser_click` with `target: "a[href='/observatory']"`. The page title reads `Evaluation Observatory` and displays `Active Strategy Overlay (5/5)`.
- **Select single-asset symbol.** Click `NVDA` dataset button. Run `browser_click` with `target: "button:has-text('NVDA')"`. The tearsheet re-evaluates and displays `Symbol: NVDA` with updated return metrics.
- **Select Universe Basket.** Click `Universe (AAPL+NVDA+SPY)` button. Run `browser_click` with `target: "button:has-text('Universe')"`. The benchmark switches to `1/N Equal-Weight Basket (Benchmark)` and renders the multi-asset allocation table.
- **Toggle Strategy Ablation.** Click the `Multi-Agent (Debate OFF / Ablation)` toggle button to hide/show that series from the comparative equity curve.
- **Audit Lineage CTA.** Click the `Audit Lineage` button to navigate directly to the Decision Lineage inspector with the active symbol and strategy parameters preselected.
- **Capture proof.** Run `browser_take_screenshot` to `artifacts/verify-committee/observatory.png` and `browser_snapshot` to `artifacts/verify-committee/observatory.snapshot.yml`.

## Gotchas

- In Universe mode, single-asset variance sweep controls are disabled.
- The tearsheet displays deltas (`Δ Return`, `Δ Sharpe`) relative to the benchmark strategy (`Buy & Hold` in single-asset mode, `1/N Equal-Weight Basket` in multi-asset mode).
- Offline evaluation runs use frozen local JSON fixtures and do not trigger outbound network requests or LLM API billing.
