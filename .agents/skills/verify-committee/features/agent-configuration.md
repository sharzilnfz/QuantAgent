# Agent Committee Configuration

The Agent Committee Configuration center allows operators to tune specialist agent voting weights, consensus deliberation thresholds, deterministic risk limits, and operational circuit breakers.

## Sub-features

- `config-specialist-weights` adjusts relative weighting for Technical, Sentiment, Fundamental, and Polymarket agents (summing to 1.0).
- `config-debate-parameters` tunes consensus confidence thresholds, maximum debate rounds, and minimum deliberation margins.
- `config-risk-limits` configures maximum drawdown circuit breaker percentage, single-asset exposure ceiling, and minimum cash reserve requirements.
- `config-persistence` saves updated parameters to the backend and supports instant rollback to system defaults.

## How to get to it (user POV)

- Choose `Agent Config` (`/config`) in the primary sidebar navigation.

## Driving it with Playwright

Preconditions:
- User is authenticated as `demo@committee.local`.
- Web UI is running at `http://localhost:5173`.
- API server is running at `http://localhost:3000`.

- **Open Configuration.** Click sidebar link. Run `browser_click` with `target: "a[href='/config']"`. The page heading reads `Agent Committee Configuration`.
- **Adjust Specialist Weight.** Change the Technical Analyst weight slider or number input. Observe real-time normalization across remaining weights.
- **Set Max Drawdown Circuit Breaker.** Enter `0.15` (15% max drawdown). Run `browser_fill_form` or interact with the risk parameter inputs.
- **Save Configuration.** Click the `Save Changes` button. Run `browser_click` with `target: "button[type='submit']"`. Observe the green confirmation banner `Saved successfully`.
- **Reset to Defaults.** Click the `Reset to Defaults` button and confirm the modal prompt. All thresholds revert to system defaults.
- **Capture proof.** Run `browser_take_screenshot` to `artifacts/verify-committee/config.png` and `browser_snapshot` to `artifacts/verify-committee/config.snapshot.yml`.

## Gotchas

- Weight sums must remain valid across specialist agents.
- Lowering the consensus threshold below 0.5 can lead to tie-break conditions handled by the coordinator's fallback policy.
- Changes made in the configuration UI immediately influence subsequent live deliberations and daemon execution cycles.
