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
 * Native OpenRouter LLM client (calls OpenRouter Chat Completions endpoint).
 */
export class OpenRouterLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey ?? config.ANTHROPIC_API_KEY;
    this.baseUrl = options.baseUrl || config.ANTHROPIC_BASE_URL || "https://openrouter.ai/api/v1";
  }

  async completeStructured(request: LlmStructuredRequest): Promise<unknown> {
    const model = request.model.includes("/")
      ? request.model
      : `anthropic/${request.model.replace("claude-haiku-4-5", "claude-3-haiku")}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
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
      throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const raw = toolCall.function.arguments;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }

    throw new Error("OpenRouter returned no tool call response");
  }
}

/**
 * Factory function to create the appropriate LLM client based on configuration.
 */
export function createLlmClient(options: AnthropicLlmClientOptions = {}): LlmClient {
  const key = options.apiKey ?? config.ANTHROPIC_API_KEY;
  const baseUrl = config.ANTHROPIC_BASE_URL;
  if (key.startsWith("sk-or-v1-") || baseUrl.includes("openrouter.ai")) {
    return new OpenRouterLlmClient({ apiKey: key, baseUrl: baseUrl || undefined });
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
