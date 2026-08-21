import type { RiskRuleEvaluator } from "../types.js";

/**
 * Rule 3: Portfolio Drawdown Circuit Breaker.
 * Computes historical peak-to-trough equity drawdown. If drawdown exceeds config.maxDrawdownCircuitBreaker (e.g. 15%),
 * blocks all new risk acquisition (bullish entries) to halt capital erosion.
 */
export const evaluateDrawdownCircuitBreakerRule: RiskRuleEvaluator = (ctx) => {
  const { direction, portfolio, portfolioHistory, config } = ctx;

  if (direction !== "bullish") {
    return {
      ruleId: "drawdown_circuit_breaker",
      name: "Portfolio Drawdown Circuit Breaker",
      passed: true,
      severity: "BLOCKING",
      currentValue: 0,
      threshold: config.maxDrawdownCircuitBreaker,
      message: "Circuit breaker does not block derisking or neutral actions.",
    };
  }

  const currentEquity = portfolio.equity;
  let peakEquity = currentEquity;

  if (portfolioHistory && portfolioHistory.length > 0) {
    for (const record of portfolioHistory) {
      if (record.equity > peakEquity) {
        peakEquity = record.equity;
      }
    }
  }

  const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 0;

  if (drawdown >= config.maxDrawdownCircuitBreaker) {
    return {
      ruleId: "drawdown_circuit_breaker",
      name: "Portfolio Drawdown Circuit Breaker",
      passed: false,
      severity: "BLOCKING",
      currentValue: drawdown,
      threshold: config.maxDrawdownCircuitBreaker,
      message: `Portfolio drawdown of ${(drawdown * 100).toFixed(1)}% breached the ${(config.maxDrawdownCircuitBreaker * 100).toFixed(1)}% circuit breaker. New buying is halted.`,
    };
  }

  return {
    ruleId: "drawdown_circuit_breaker",
    name: "Portfolio Drawdown Circuit Breaker",
    passed: true,
    severity: "BLOCKING",
    currentValue: drawdown,
    threshold: config.maxDrawdownCircuitBreaker,
    message: `Current drawdown of ${(drawdown * 100).toFixed(1)}% is within the ${(config.maxDrawdownCircuitBreaker * 100).toFixed(1)}% limit.`,
  };
};
