import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Zod-validated environment configuration.
 * The server fails fast at startup if any required variable is missing.
 */
const envSchema = z.object({
  // Postgres
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),

  // Encryption
  APP_ENCRYPTION_KEY: z.string().refine((val) => {
    try {
      const raw = val.startsWith("base64:") ? val.slice(7) : val;
      return Buffer.from(raw, "base64").length === 32;
    } catch {
      return false;
    }
  }, { message: "APP_ENCRYPTION_KEY must decode to exactly 32 bytes from base64" }),

  // Services
  QUANT_SERVICE_URL: z.string().url(),
  BACKEND_PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url(),

  // Alpaca
  ALPACA_BASE_URL: z.string().url().default("https://paper-api.alpaca.markets"),
  ALPACA_DATA_URL: z.string().url().default("https://data.alpaca.markets"),

  // LLM (scaffold, unused Sprint 1)
  OPENROUTER_API_KEY: z.string().optional(),

  // Runtime
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌ Invalid environment configuration:",
      result.error.format()
    );
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
