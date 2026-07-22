import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

/**
 * Typed, validated environment config. Import `config` anywhere in the API.
 * Fails fast at boot if a required var is missing — except in test, where
 * sensible defaults keep pure unit tests runnable without external infra.
 */
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

const EnvSchema = z.object({
  DATABASE_URL: z.string().default("postgres://committee:committee@localhost:5432/committee"),
  CREDENTIAL_ENC_KEY: z.string().default(isTest ? Buffer.alloc(32).toString("base64") : ""),
  SESSION_TTL: z.coerce.number().int().positive().default(604800),
  ALPACA_KEY: z.string().default(""),
  ALPACA_SECRET: z.string().default(""),
  ALPACA_DATA_URL: z.string().default("https://data.alpaca.markets"),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_BASE_URL: z.string().default(""),
  LLM_CHEAP_MODEL: z.string().default("claude-haiku-4-5"),
  QUANT_SERVICE_URL: z.string().default("http://localhost:8000"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default("development"),
});

export const config = EnvSchema.parse(process.env);
export type AppConfig = z.infer<typeof EnvSchema>;
