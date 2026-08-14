/**
 * Telemetry and metrics tracker for SentimentAgent execution.
 * Tracks calls, successes, point-in-time violations, fallbacks, timeouts, and schema errors.
 */

export interface SentimentTelemetrySnapshot {
  readonly totalCalls: number;
  readonly successCount: number;
  readonly fallbackCount: number;
  readonly timeoutCount: number;
  readonly invalidSchemaCount: number;
  readonly errorCount: number;
  readonly pitViolationsFiltered: number;
  readonly noNewsCount: number;
}

export class SentimentTelemetry {
  private totalCalls = 0;
  private successCount = 0;
  private fallbackCount = 0;
  private timeoutCount = 0;
  private invalidSchemaCount = 0;
  private errorCount = 0;
  private pitViolationsFiltered = 0;
  private noNewsCount = 0;

  recordCall(): void {
    this.totalCalls += 1;
  }

  recordSuccess(): void {
    this.successCount += 1;
  }

  recordFallback(_reason: string): void {
    this.fallbackCount += 1;
  }

  recordTimeout(): void {
    this.timeoutCount += 1;
  }

  recordInvalid(): void {
    this.invalidSchemaCount += 1;
  }

  recordError(_err: unknown): void {
    this.errorCount += 1;
  }

  recordPitViolation(): void {
    this.pitViolationsFiltered += 1;
  }

  recordNoNews(): void {
    this.noNewsCount += 1;
  }

  getSnapshot(): SentimentTelemetrySnapshot {
    return {
      totalCalls: this.totalCalls,
      successCount: this.successCount,
      fallbackCount: this.fallbackCount,
      timeoutCount: this.timeoutCount,
      invalidSchemaCount: this.invalidSchemaCount,
      errorCount: this.errorCount,
      pitViolationsFiltered: this.pitViolationsFiltered,
      noNewsCount: this.noNewsCount,
    };
  }

  reset(): void {
    this.totalCalls = 0;
    this.successCount = 0;
    this.fallbackCount = 0;
    this.timeoutCount = 0;
    this.invalidSchemaCount = 0;
    this.errorCount = 0;
    this.pitViolationsFiltered = 0;
    this.noNewsCount = 0;
  }
}
