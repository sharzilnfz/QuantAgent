import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../src/config.js";
import {
  createLlmClient,
  FallbackLlmClient,
  GeminiLlmClient,
  isLlmConfigured,
  OpenAiCompatibleLlmClient,
  AnthropicLlmClient,
  type LlmClient,
  type LlmStructuredRequest,
} from "../src/agents/technical/llm-client.js";

const sampleRequest: LlmStructuredRequest = {
  model: "meta-llama/llama-3.3-70b-instruct:free",
  system: "You are a quantitative trading assistant.",
  user: "Analyze AAPL with technical indicators.",
  toolName: "emit_agent_output",
  toolSchema: {
    type: "object",
    properties: {
      direction: { type: "string" },
      confidence: { type: "number" },
    },
    required: ["direction", "confidence"],
  },
  maxTokens: 512,
};

describe("GeminiLlmClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws error if GEMINI_API_KEY is not configured", async () => {
    const client = new GeminiLlmClient({ apiKey: "" });
    await expect(client.completeStructured(sampleRequest)).rejects.toThrow(
      "GEMINI_API_KEY is not configured"
    );
  });

  it("sends standard OpenAI-compatible tool call payload to Gemini endpoint and parses string JSON arguments", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    const mockResponsePayload = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "emit_agent_output",
                  arguments: JSON.stringify({ direction: "bullish", confidence: 0.85 }),
                },
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedOptions = init;
      return new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new GeminiLlmClient({
      apiKey: "test-gemini-key",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      defaultModel: "gemini-2.0-flash",
    });

    const result = await client.completeStructured(sampleRequest);

    expect(capturedUrl).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-gemini-key",
    });

    const parsedBody = JSON.parse(capturedOptions?.body as string);
    // Non-Gemini model meta-llama/... mapped to default Gemini model
    expect(parsedBody.model).toBe("gemini-2.0-flash");
    expect(parsedBody.messages).toHaveLength(2);
    expect(parsedBody.messages[0]).toEqual({
      role: "system",
      content: sampleRequest.system,
    });
    expect(parsedBody.messages[1]).toEqual({
      role: "user",
      content: sampleRequest.user,
    });
    expect(parsedBody.tools[0].function.name).toBe("emit_agent_output");
    expect(parsedBody.tool_choice).toEqual({
      type: "function",
      function: { name: "emit_agent_output" },
    });

    expect(result).toEqual({ direction: "bullish", confidence: 0.85 });
  });

  it("preserves explicit gemini model names in request", async () => {
    let capturedBody: any;
    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "emit_agent_output",
                      arguments: { direction: "bearish", confidence: 0.6 },
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const client = new GeminiLlmClient({
      apiKey: "test-gemini-key",
    });

    const result = await client.completeStructured({
      ...sampleRequest,
      model: "gemini-1.5-pro",
    });

    expect(capturedBody.model).toBe("gemini-1.5-pro");
    expect(result).toEqual({ direction: "bearish", confidence: 0.6 });
  });

  it("handles HTTP error from Gemini endpoint", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Quota exceeded for quota metric", {
        status: 429,
        statusText: "Too Many Requests",
      });
    });

    const client = new GeminiLlmClient({ apiKey: "test-gemini-key" });
    await expect(client.completeStructured(sampleRequest)).rejects.toThrow(
      "Gemini API error (429): Quota exceeded for quota metric"
    );
  });

  it("throws error when response contains no tool calls", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Here is plain text with no tool call." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const client = new GeminiLlmClient({ apiKey: "test-gemini-key" });
    await expect(client.completeStructured(sampleRequest)).rejects.toThrow(
      "Gemini API endpoint returned no structured tool call response"
    );
  });
});

describe("FallbackLlmClient", () => {
  it("returns primary client result when primary succeeds without calling fallbacks", async () => {
    const primaryResult = { direction: "bullish", confidence: 0.9 };
    const primary: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue(primaryResult),
    };
    const fallback: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue({ direction: "neutral", confidence: 0.5 }),
    };

    const client = new FallbackLlmClient(primary, [fallback]);
    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual(primaryResult);
    expect(primary.completeStructured).toHaveBeenCalledTimes(1);
    expect(fallback.completeStructured).not.toHaveBeenCalled();
  });

  it("calls fallback client when primary fails", async () => {
    const fallbackResult = { direction: "bearish", confidence: 0.75 };
    const primary: LlmClient = {
      completeStructured: vi.fn().mockRejectedValue(new Error("OpenRouter rate limit 429")),
    };
    const fallback: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue(fallbackResult),
    };

    const client = new FallbackLlmClient(primary, [fallback]);
    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual(fallbackResult);
    expect(primary.completeStructured).toHaveBeenCalledTimes(1);
    expect(fallback.completeStructured).toHaveBeenCalledTimes(1);
  });

  it("chains through multiple fallbacks until one succeeds", async () => {
    const finalResult = { direction: "neutral", confidence: 0.6 };
    const primary: LlmClient = {
      completeStructured: vi.fn().mockRejectedValue(new Error("Primary down")),
    };
    const fallback1: LlmClient = {
      completeStructured: vi.fn().mockRejectedValue(new Error("Fallback 1 timeout")),
    };
    const fallback2: LlmClient = {
      completeStructured: vi.fn().mockResolvedValue(finalResult),
    };

    const client = new FallbackLlmClient(primary, [fallback1, fallback2]);
    const result = await client.completeStructured(sampleRequest);

    expect(result).toEqual(finalResult);
    expect(primary.completeStructured).toHaveBeenCalledTimes(1);
    expect(fallback1.completeStructured).toHaveBeenCalledTimes(1);
    expect(fallback2.completeStructured).toHaveBeenCalledTimes(1);
  });

  it("throws aggregate error if primary and all fallbacks fail", async () => {
    const primary: LlmClient = {
      completeStructured: vi.fn().mockRejectedValue(new Error("Primary auth failed")),
    };
    const fallback: LlmClient = {
      completeStructured: vi.fn().mockRejectedValue(new Error("Gemini quota 429")),
    };

    const client = new FallbackLlmClient(primary, [fallback]);
    await expect(client.completeStructured(sampleRequest)).rejects.toThrow(
      "All LLM clients in fallback chain failed: [Attempt 1] Primary auth failed; [Attempt 2] Gemini quota 429"
    );
  });
});

describe("isLlmConfigured and createLlmClient factory", () => {
  const originalEnv = {
    LLM_PROVIDER: config.LLM_PROVIDER,
    OPENROUTER_API_KEY: config.OPENROUTER_API_KEY,
    OPENAI_API_KEY: config.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: config.ANTHROPIC_BASE_URL,
    OPENAI_BASE_URL: config.OPENAI_BASE_URL,
    GEMINI_API_KEY: config.GEMINI_API_KEY,
    GEMINI_BASE_URL: config.GEMINI_BASE_URL,
    GEMINI_MODEL: config.GEMINI_MODEL,
  };

  afterEach(() => {
    Object.assign(config, originalEnv);
  });

  it("isLlmConfigured returns true when GEMINI_API_KEY is present", () => {
    (config as any).OPENROUTER_API_KEY = "";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "AIzaSyTestKey";

    expect(isLlmConfigured()).toBe(true);
  });

  it("isLlmConfigured returns false when no provider keys or URLs are set", () => {
    (config as any).OPENROUTER_API_KEY = "";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "";

    expect(isLlmConfigured()).toBe(false);
  });

  it("createLlmClient returns GeminiLlmClient when provider is gemini", () => {
    (config as any).LLM_PROVIDER = "gemini";
    (config as any).GEMINI_API_KEY = "AIzaSyTestKey";

    const client = createLlmClient();
    expect(client).toBeInstanceOf(GeminiLlmClient);
  });

  it("createLlmClient returns FallbackLlmClient with Gemini fallback when primary key and GEMINI_API_KEY are configured", () => {
    (config as any).LLM_PROVIDER = "auto";
    (config as any).OPENROUTER_API_KEY = "sk-or-v1-testkey";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "AIzaSyTestKey";

    const client = createLlmClient();
    expect(client).toBeInstanceOf(FallbackLlmClient);

    const fallbackClient = client as FallbackLlmClient;
    expect(fallbackClient.primary).toBeInstanceOf(OpenAiCompatibleLlmClient);
    expect(fallbackClient.fallbacks).toHaveLength(1);
    expect(fallbackClient.fallbacks[0]).toBeInstanceOf(GeminiLlmClient);
  });

  it("createLlmClient returns GeminiLlmClient when only GEMINI_API_KEY is configured", () => {
    (config as any).LLM_PROVIDER = "auto";
    (config as any).OPENROUTER_API_KEY = "";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "AIzaSyTestKey";

    const client = createLlmClient();
    expect(client).toBeInstanceOf(GeminiLlmClient);
  });

  it("createLlmClient returns primary client alone when GEMINI_API_KEY is not configured", () => {
    (config as any).LLM_PROVIDER = "auto";
    (config as any).OPENROUTER_API_KEY = "sk-or-v1-testkey";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "";

    const client = createLlmClient();
    expect(client).toBeInstanceOf(OpenAiCompatibleLlmClient);
  });

  it("preserves backward compatibility when options are passed to createLlmClient", () => {
    (config as any).LLM_PROVIDER = "auto";
    (config as any).OPENROUTER_API_KEY = "";
    (config as any).OPENAI_API_KEY = "";
    (config as any).ANTHROPIC_API_KEY = "";
    (config as any).ANTHROPIC_BASE_URL = "";
    (config as any).OPENAI_BASE_URL = "";
    (config as any).GEMINI_API_KEY = "";

    const client = createLlmClient({ apiKey: "sk-ant-api03-testkey" });
    expect(client).toBeInstanceOf(AnthropicLlmClient);
  });
});
