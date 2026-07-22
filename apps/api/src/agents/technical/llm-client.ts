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
 * matches `AgentOutputJsonSchema` — the SDK pinned in this repo predates the
 * `output_config.format` structured-outputs parameter, and a forced single-tool
 * call is the supported equivalent on that version.
 *
 * The SDK instance is constructed LAZILY so importing this module never requires
 * `ANTHROPIC_API_KEY` to be present (tests import it; CI has no key).
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
      this.client = new Anthropic({ apiKey: this.apiKey });
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
 * Test double. Returns queued payloads in order; the last one repeats once the
 * queue drains, which makes "malformed then malformed again" easy to express.
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
