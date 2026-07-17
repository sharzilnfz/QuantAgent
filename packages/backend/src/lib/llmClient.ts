import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("llm-client");

/**
 * OpenRouter / Claude LLM client abstraction.
 *
 * Scaffolded for Sprint 1, but NOT used on the critical path yet.
 * The technical agent uses deterministic logic.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_MODEL = "anthropic/claude-3-opus-20240229";

export class LLMClient {
  private apiKey: string;
  private baseUrl: string = "https://openrouter.ai/api/v1";

  constructor() {
    // Scaffolded for later sprints
    this.apiKey = config.OPENROUTER_API_KEY ?? "";
  }

  async generate(
    messages: LLMMessage[],
    opts: LLMOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      logger.warn("OpenRouter API key missing, returning mock response");
      return "Mock LLM response (Sprint 1 placeholder)";
    }

    const model = opts.model ?? DEFAULT_MODEL;
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
    };

    logger.debug({ model, messageCount: messages.length }, "Calling LLM");

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:4000",
          "X-Title": "QuantAgent",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter API error: ${res.status} ${text}`);
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      logger.error({ err }, "LLM generation failed");
      throw err;
    }
  }
}

// Export a singleton instance
export const llm = new LLMClient();
