/**
 * Hard Budget Guard enforcing cumulative LLM spend ceilings during evaluation sweeps.
 */
export class BudgetExceededError extends Error {
  public readonly cumulativeCost: number;
  public readonly budgetLimit: number;

  constructor(message: string, cumulativeCost: number, budgetLimit: number) {
    super(message);
    this.name = "BudgetExceededError";
    this.cumulativeCost = cumulativeCost;
    this.budgetLimit = budgetLimit;
    Object.setPrototypeOf(this, BudgetExceededError.prototype);
  }
}

export interface BudgetGuardOptions {
  /** Hard maximum spend ceiling in USD. Default is $5.00. */
  maxBudgetUsd?: number;
  /** Estimated cost per call when token usage is not explicitly available. Default $0.005 */
  fallbackCostPerCallUsd?: number;
}

export interface BudgetSnapshot {
  cumulativeCostUsd: number;
  remainingBudgetUsd: number;
  maxBudgetUsd: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  budgetExceeded: boolean;
}

// Token pricing rate cards ($ per 1M tokens)
const MODEL_RATES: Record<string, { promptPerM: number; completionPerM: number }> = {
  "claude-3-5-haiku-20241022": { promptPerM: 0.8, completionPerM: 4.0 },
  "claude-3-7-sonnet-20250219": { promptPerM: 3.0, completionPerM: 15.0 },
  default: { promptPerM: 1.0, completionPerM: 5.0 },
};

export class BudgetGuard {
  public readonly maxBudgetUsd: number;
  private readonly fallbackCostPerCallUsd: number;

  private cumulativeCostUsd = 0.0;
  private callCount = 0;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(options: BudgetGuardOptions = {}) {
    this.maxBudgetUsd = options.maxBudgetUsd ?? 5.0;
    this.fallbackCostPerCallUsd = options.fallbackCostPerCallUsd ?? 0.005;
  }

  /**
   * Calculate cost in USD from input/output tokens for a model.
   */
  public calculateCost(promptTokens: number, completionTokens: number, model: string = "default"): number {
    const rate = MODEL_RATES[model] ?? MODEL_RATES.default!;
    const promptCost = (promptTokens / 1_000_000) * rate.promptPerM;
    const completionCost = (completionTokens / 1_000_000) * rate.completionPerM;
    return Math.round((promptCost + completionCost) * 1_000_000) / 1_000_000;
  }

  /**
   * Assert that a planned invocation with estimated cost will not exceed the hard budget limit.
   * Throws BudgetExceededError if breached.
   */
  public assertBudget(estimatedCostUsd: number = 0): void {
    if (this.cumulativeCostUsd + estimatedCostUsd > this.maxBudgetUsd) {
      throw new BudgetExceededError(
        `Budget limit of $${this.maxBudgetUsd.toFixed(2)} exceeded! Current cumulative spend: $${this.cumulativeCostUsd.toFixed(4)}, estimated addition: $${estimatedCostUsd.toFixed(4)}`,
        this.cumulativeCostUsd + estimatedCostUsd,
        this.maxBudgetUsd,
      );
    }
  }

  /**
   * Record spend directly in USD.
   */
  public recordSpend(costUsd: number): BudgetSnapshot {
    this.assertBudget(costUsd);
    this.cumulativeCostUsd = Math.round((this.cumulativeCostUsd + costUsd) * 1_000_000) / 1_000_000;
    this.callCount += 1;
    return this.getSnapshot();
  }

  /**
   * Record spend from token usage.
   */
  public recordTokens(promptTokens: number, completionTokens: number, model: string = "default"): BudgetSnapshot {
    const cost = this.calculateCost(promptTokens, completionTokens, model);
    this.assertBudget(cost);
    this.cumulativeCostUsd = Math.round((this.cumulativeCostUsd + cost) * 1_000_000) / 1_000_000;
    this.callCount += 1;
    this.inputTokens += promptTokens;
    this.outputTokens += completionTokens;
    return this.getSnapshot();
  }

  /**
   * Return current budget telemetry snapshot.
   */
  public getSnapshot(): BudgetSnapshot {
    return {
      cumulativeCostUsd: this.cumulativeCostUsd,
      remainingBudgetUsd: Math.max(0, Math.round((this.maxBudgetUsd - this.cumulativeCostUsd) * 1_000_000) / 1_000_000),
      maxBudgetUsd: this.maxBudgetUsd,
      callCount: this.callCount,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      budgetExceeded: this.cumulativeCostUsd >= this.maxBudgetUsd,
    };
  }

  /**
   * Reset budget tracker.
   */
  public reset(): void {
    this.cumulativeCostUsd = 0.0;
    this.callCount = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
  }
}
