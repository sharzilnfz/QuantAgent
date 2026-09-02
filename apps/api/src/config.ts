import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();
for (const rel of [".env", "../../.env", "../../../.env"]) {
  const p = resolve(process.cwd(), rel);
  if (existsSync(p)) {
    loadEnv({ path: p, override: false });
  }
}

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
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_BASE_URL: z.string().default(""),
  OPENROUTER_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_BASE_URL: z.string().default("https://generativelanguage.googleapis.com/v1beta/openai"),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  LLM_PROVIDER: z.enum(["anthropic", "openai", "openrouter", "gemini", "auto"]).default("auto"),
  LLM_CHEAP_MODEL: z.string().default("meta-llama/llama-3.3-70b-instruct:free"),
  QUANT_SERVICE_URL: z.string().default("http://localhost:8000"),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
  API_PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default("development"),
});

export const config = EnvSchema.parse(process.env);
export type AppConfig = z.infer<typeof EnvSchema>;
