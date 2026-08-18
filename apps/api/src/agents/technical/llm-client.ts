import Anthropic from "@anthropic-ai/sdk";

import { config } from "../../config.js";

/**
 * Spec 07 §5 — the LLM seam.
 *
 * The client is an INTERFACE, not a concrete class, so CI can inject a recorded
 * response: no live API call, no flake, no budget burn. `TechnicalAgent` takes one
 * by constructor injection and never reaches for the SDK itself.
 *
 * The client returns the raw tool input as `unknown`. It is UNTRUSTED model text
 * until the caller runs `AgentOutput.parse` on it (cross-cutting law #3) — this
 * module deliberately does no validation of its own.
 */

export interface LlmStructuredRequest {
  model: string;
  system: string;
  user: string;
  /** Name of the tool the model is forced to call. */
  toolName: string;
  /** JSON Schema for the tool input — derived from `AgentOutputJsonSchema`. */
  toolSchema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LlmClient {
  /** Returns the model's structured payload, unvalidated. */
  completeStructured(request: LlmStructuredRequest): Promise<unknown>;
}

export interface AnthropicLlmClientOptions {
  apiKey?: string;
  /** Inject a pre-built SDK instance (useful for integration harnesses). */
  client?: Anthropic;
}

/**
 * Real Claude-backed client. Uses forced tool use to obtain structured JSON that
 * matches `AgentOutputJsonSchema`.
 */
export class AnthropicLlmClient implements LlmClient {
  private client: Anthropic | undefined;
  private readonly apiKey: string;

  constructor(options: AnthropicLlmClientOptions = {}) {
    this.apiKey = options.apiKey ?? config.ANTHROPIC_API_KEY;
    this.client = options.client;
  }

  private sdk(): Anthropic {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not configured");
      }
      this.client = new Anthropic({
        apiKey: this.apiKey,
        ...(config.ANTHROPIC_BASE_URL ? { baseURL: config.ANTHROPIC_BASE_URL } : {}),
      });
    }
    return this.client;
  }

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    const response = await this.sdk().messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 1024,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      tools: [
        {
          name: request.toolName,
          description:
            "Emit the validated agent output. This is the only way to reply.",
          input_schema: request.toolSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: request.toolName },
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === request.toolName) {
        return block.input;
      }
    }

    throw new Error("model returned no tool_use block");
  }
}

/**
 * Standard OpenAI-compatible LLM client (supporting OpenAI, OpenRouter, DeepSeek, Groq, Ollama, Together, etc.).
 * Uses OpenAI-standard function calling (`tools` array with JSON schema) for structured outputs.
 */
export class OpenAiCompatibleLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isRawOpenRouter: boolean;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    const rawKey =
      options.apiKey ??
      config.OPENAI_API_KEY ??
      config.OPENROUTER_API_KEY ??
      config.ANTHROPIC_API_KEY;
    this.apiKey = rawKey;

    const rawUrl =
      options.baseUrl ||
      config.OPENAI_BASE_URL ||
      config.ANTHROPIC_BASE_URL ||
      (rawKey.startsWith("sk-or-v1-") || Boolean(config.OPENROUTER_API_KEY)
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1");

    this.baseUrl = rawUrl.replace(/\/+$/, "");
    this.isRawOpenRouter = this.baseUrl.includes("openrouter.ai") || rawKey.startsWith("sk-or-v1-");
  }

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    const model = request.model || config.LLM_CHEAP_MODEL;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    if (this.isRawOpenRouter) {
      headers["HTTP-Referer"] = "https://github.com/sharzilnfz/QuantAgent";
      headers["X-Title"] = "QuantAgent Observatory";
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          ...(request.system ? [{ role: "system", content: request.system }] : []),
          { role: "user", content: request.user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: request.toolName,
              description: "Emit the validated agent output. This is the only way to reply.",
              parameters: request.toolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: request.toolName } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API standard error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const raw = toolCall.function.arguments;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }

    throw new Error("OpenAI API endpoint returned no structured tool call response");
  }
}

/** Backward-compatibility alias for OpenRouter */
export class OpenRouterLlmClient extends OpenAiCompatibleLlmClient {}

export interface GeminiLlmClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Google Gemini client using the OpenAI-compatible v1beta endpoint.
 * Defaults to `https://generativelanguage.googleapis.com/v1beta/openai` and `gemini-2.0-flash`.
 * Automatically maps non-Gemini model identifiers to the configured Gemini model.
 */
export class GeminiLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: GeminiLlmClientOptions = {}) {
    this.apiKey = options.apiKey ?? config.GEMINI_API_KEY;
    this.baseUrl = (
      options.baseUrl ||
      config.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta/openai"
    ).replace(/\/+$/, "");
    this.defaultModel =
      options.defaultModel || config.GEMINI_MODEL || "gemini-2.0-flash";
  }

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Map non-Gemini model identifiers (e.g. meta-llama/..., claude-..., gpt-...) to default Gemini model
    const model =
      request.model && request.model.toLowerCase().includes("gemini")
        ? request.model
        : this.defaultModel;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          ...(request.system ? [{ role: "system", content: request.system }] : []),
          { role: "user", content: request.user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: request.toolName,
              description: "Emit the validated agent output. This is the only way to reply.",
              parameters: request.toolSchema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: request.toolName } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const raw = toolCall.function.arguments;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }

    throw new Error("Gemini API endpoint returned no structured tool call response");
  }
}

/**
 * Composite LLM client that tries a primary client first, and falls back to
 * one or more fallback clients in sequence upon failure.
 */
export class FallbackLlmClient implements LlmClient {
  constructor(
    public readonly primary: LlmClient,
    public readonly fallbacks: LlmClient[] = [],
  ) {}

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    const errors: Error[] = [];
    try {
      return await this.primary.completeStructured(request);
    } catch (err) {
      const primaryErr = err instanceof Error ? err : new Error(String(err));
      errors.push(primaryErr);
      console.warn(
        `[FallbackLlmClient] Primary LLM client failed: ${primaryErr.message}. Attempting fallback(s)...`
      );

      for (let i = 0; i < this.fallbacks.length; i++) {
        const fallback = this.fallbacks[i];
        if (!fallback) {
          continue;
        }
        try {
          return await fallback.completeStructured(request);
        } catch (fallbackErr) {
          const errObj =
            fallbackErr instanceof Error
              ? fallbackErr
              : new Error(String(fallbackErr));
          errors.push(errObj);
          console.warn(
            `[FallbackLlmClient] Fallback #${i + 1} failed: ${errObj.message}`
          );
        }
      }
    }

    const message = errors.map((e, idx) => `[Attempt ${idx + 1}] ${e.message}`).join("; ");
    throw new Error(`All LLM clients in fallback chain failed: ${message}`);
  }
}

/**
 * Check whether any LLM provider key or compatible base URL is configured.
 */
export function isLlmConfigured(): boolean {
  return Boolean(
    config.OPENAI_API_KEY ||
    config.OPENROUTER_API_KEY ||
    config.ANTHROPIC_API_KEY ||
    config.OPENAI_BASE_URL ||
    config.ANTHROPIC_BASE_URL ||
    config.GEMINI_API_KEY
  );
}

export interface CreateLlmClientOptions extends AnthropicLlmClientOptions {
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  geminiModel?: string;
}

/**
 * Factory function to create the appropriate LLM client based on configuration.
 */
export function createLlmClient(options: CreateLlmClientOptions = {}): LlmClient {
  const provider = config.LLM_PROVIDER;
  const anthropicKey = options.apiKey ?? config.ANTHROPIC_API_KEY;
  const openaiKey = config.OPENAI_API_KEY;
  const openrouterKey = config.OPENROUTER_API_KEY;
  const geminiKey = options.geminiApiKey ?? config.GEMINI_API_KEY;
  const openaiBaseUrl = config.OPENAI_BASE_URL;
  const anthropicBaseUrl = config.ANTHROPIC_BASE_URL;

  // If explicitly configured as Gemini provider, return Gemini client
  if (provider === "gemini") {
    return new GeminiLlmClient({
      apiKey: geminiKey,
      baseUrl: options.geminiBaseUrl,
      defaultModel: options.geminiModel,
    });
  }

  let primaryClient: LlmClient | undefined;

  // 1. OpenRouter
  if (
    provider === "openrouter" ||
    Boolean(openrouterKey) ||
    anthropicKey.startsWith("sk-or-") ||
    openaiKey.startsWith("sk-or-") ||
    anthropicBaseUrl.includes("openrouter.ai") ||
    openaiBaseUrl.includes("openrouter.ai")
  ) {
    primaryClient = new OpenAiCompatibleLlmClient({
      apiKey: openrouterKey || (anthropicKey.startsWith("sk-or-") ? anthropicKey : "") || openaiKey,
      baseUrl:
        openaiBaseUrl ||
        (anthropicBaseUrl.includes("openrouter.ai") ? anthropicBaseUrl : "") ||
        "https://openrouter.ai/api/v1",
    });
  } else if (
    // 2. OpenAI
    provider === "openai" ||
    Boolean(openaiKey) ||
    Boolean(openaiBaseUrl) ||
    (anthropicKey.startsWith("sk-") && !anthropicKey.startsWith("sk-ant-"))
  ) {
    primaryClient = new OpenAiCompatibleLlmClient({
      apiKey: openaiKey || anthropicKey,
      baseUrl: openaiBaseUrl || "https://api.openai.com/v1",
    });
  } else if (
    // 3. Anthropic
    provider === "anthropic" ||
    Boolean(anthropicKey) ||
    Boolean(anthropicBaseUrl) ||
    Boolean(options.client)
  ) {
    primaryClient = new AnthropicLlmClient(options);
  }

  // If Gemini API key is configured alongside a primary provider, attach fallback
  if (primaryClient && geminiKey) {
    const geminiClient = new GeminiLlmClient({
      apiKey: geminiKey,
      baseUrl: options.geminiBaseUrl,
      defaultModel: options.geminiModel,
    });
    return new FallbackLlmClient(primaryClient, [geminiClient]);
  }

  if (primaryClient) {
    return primaryClient;
  }

  // If only Gemini key is configured
  if (geminiKey) {
    return new GeminiLlmClient({
      apiKey: geminiKey,
      baseUrl: options.geminiBaseUrl,
      defaultModel: options.geminiModel,
    });
  }

  return new AnthropicLlmClient(options);
}

/**
 * Test double. Returns queued payloads in order.
 */
export class ScriptedLlmClient implements LlmClient {
  readonly requests: LlmStructuredRequest[] = [];
  private index = 0;

  constructor(private readonly payloads: Array<unknown | (() => unknown)>) {}

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    this.requests.push(request);
    const at = Math.min(this.index, this.payloads.length - 1);
    this.index += 1;
    const payload = this.payloads[at];
    return typeof payload === "function" ? (payload as () => unknown)() : payload;
  }

  get callCount(): number {
    return this.index;
  }
}
