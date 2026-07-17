import pino from "pino";

/**
 * Structured JSON logger using pino.
 * In development, pipe through pino-pretty for human-readable output.
 * In production / CI, emit raw JSON for log aggregation.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with a specific module context.
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
