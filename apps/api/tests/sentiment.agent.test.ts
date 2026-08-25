import { describe, expect, it } from "vitest";
import {
  AgentOutput,
  type AgentInput,
  type NewsItem,
} from "@committee/contracts";

import { NO_OPINION } from "../src/agents/base.js";
import { runAgents } from "../src/agents/runner.js";
import {
  SentimentAgent,
  blendConfidence,
} from "../src/agents/sentiment/agent.js";
import {
  classifyHeadlines,
  classifySentimentHeadlines,
} from "../src/agents/sentiment/classify.js";
import {
  InMemoryNewsProvider,
  FixtureNewsProvider,
} from "../src/agents/sentiment/news-provider.js";
import {
  AGENT_OUTPUT_TOOL_NAME,
  normalizeSentimentModelOutput,
} from "../src/agents/sentiment/prompt.js";
import { SentimentTelemetry } from "../src/agents/sentiment/telemetry.js";
import { ScriptedLlmClient } from "../src/agents/technical/llm-client.js";
import { DECISION_TS, makeInput, silentLogger } from "./agents.helpers.js";

const RUN_ID = "55555555-5555-5555-8555-555555555555";

function makeNewsItem(
  id: string,
  headline: string,
  asOf: string = DECISION_TS,
  symbol: string = "AAPL",
): NewsItem {
  return {
    id,
    headline,
    summary: `Summary of ${headline}`,
    source: "benzinga",
    symbols: [symbol],
    publishedAt: asOf,
    asOf,
  };
}

function inputWith(overrides: Partial<AgentInput> = {}): AgentInput {
  return { ...makeInput(overrides), runId: RUN_ID } as AgentInput;
}

function obedientReply(
  direction: AgentOutput["direction"] = "bullish",
  confidence = 0.8,
) {
  return {
    agent: "sentiment",
    direction,
    confidence,
    rationale: `Sentiment is ${direction} based on strong positive earnings beats and growth updates.`,
    evidence: {},
  };
}

function makeAgent(
  payloads: unknown[],
  news: NewsItem[] = [],
  options: { deterministicOffline?: boolean } = {},
) {
  const llm = new ScriptedLlmClient(payloads);
  const telemetry = new SentimentTelemetry();
  const agent = new SentimentAgent({
    llm,
    newsProvider: new InMemoryNewsProvider(news),
    telemetry,
    model: "claude-haiku-4-5",
    logger: silentLogger,
    deterministicOffline: options.deterministicOffline,
  });
  return { agent, llm, telemetry };
}

describe("SentimentAgent — Schema & Basic Functionality", () => {
  it("returns a valid AgentOutput for valid point-in-time news", async () => {
    const news = [
      makeNewsItem("1", "Apple beats Q4 earnings expectations with record revenue surge"),
      makeNewsItem("2", "Analysts upgrade Apple to strong buy on iPhone growth"),
    ];
    const { agent, telemetry } = makeAgent([obedientReply("bullish")], news);
    const out = await agent.analyze(inputWith({ news }));

    expect(() => AgentOutput.parse(out)).not.toThrow();
    expect(out.agent).toBe("sentiment");
    expect(out.direction).toBe("bullish");
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.rationale.length).toBeGreaterThan(0);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.successCount).toBe(1);
    expect(snapshot.totalCalls).toBe(1);
  });

  it("handles model returning bias instead of direction gracefully", async () => {
    const rawWithBias = {
      agent: "sentiment",
      bias: "bullish",
      confidence: 0.85,
      rationale: "Normalized bias field to direction.",
      evidence: {},
    };

    const normalized = normalizeSentimentModelOutput(rawWithBias) as AgentOutput;
    expect(normalized.direction).toBe("bullish");

    const news = [makeNewsItem("1", "Apple surges on record earnings")];
    const { agent } = makeAgent([rawWithBias], news);
    const out = await agent.analyze(inputWith({ news }));

    expect(out.direction).toBe("bullish");
    expect(out.confidence).toBeGreaterThan(0);
  });
});

describe("SentimentAgent — Point-in-Time Discipline", () => {
  it("rejects future headlines in input.news and filters them out", async () => {
    const pastNews = makeNewsItem("1", "Apple stock gains on product launch", "2026-03-09T10:00:00.000Z");
    const futureNews = makeNewsItem("2", "Apple drops on future antitrust probe", "2026-03-12T10:00:00.000Z");

    const { agent, telemetry } = makeAgent([obedientReply("bullish")]);
    const out = await agent.analyze(inputWith({ news: [pastNews, futureNews] }));

    expect(out.evidence.headlinesConsidered).toBe(1);
    const snapshot = telemetry.getSnapshot();
    expect(snapshot.pitViolationsFiltered).toBe(1);
  });

  it("returns neutral with confidence 0 when no point-in-time news is available", async () => {
    const futureNews = makeNewsItem("1", "Future news", "2026-03-15T00:00:00.000Z");
    const { agent, telemetry, llm } = makeAgent([obedientReply("bullish")]);

    const out = await agent.analyze(inputWith({ news: [futureNews] }));

    expect(out.agent).toBe("sentiment");
    expect(out.direction).toBe("neutral");
    expect(out.confidence).toBe(0);
    expect(out.rationale).toBe("no point-in-time news available");
    expect(out.evidence.headlinesConsidered).toBe(0);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.noNewsCount).toBe(1);
    expect(llm.callCount).toBe(0);
  });
});

describe("SentimentAgent — Deterministic Offline Mode & Facts vs Narration", () => {
  it("runs deterministically offline without invoking the LLM", async () => {
    const news = [
      makeNewsItem("1", "Apple rallies to all-time high on profit surge"),
      makeNewsItem("2", "Analyst raises target, upgrades Apple"),
    ];

    const { agent, llm, telemetry } = makeAgent([], news, { deterministicOffline: true });
    const out = await agent.analyze(inputWith({ news }));

    expect(llm.callCount).toBe(0);
    expect(out.direction).toBe("bullish");
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.evidence.deterministic).toBe(true);
    expect(out.evidence.headlinesConsidered).toBe(2);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.successCount).toBe(1);
  });

  it("authoritative mechanical metrics overwrite model-authored evidence", async () => {
    const lyingModel = {
      agent: "sentiment",
      direction: "bullish",
      confidence: 0.9,
      rationale: "Fabricated headline stats.",
      evidence: {
        headlinesConsidered: 999,
        netSentimentScore: -0.8,
        bullishCount: 0,
      },
    };

    const news = [
      makeNewsItem("1", "Apple beats earnings and surges"),
      makeNewsItem("2", "Record profit reported"),
    ];

    const { agent } = makeAgent([lyingModel], news);
    const out = await agent.analyze(inputWith({ news }));

    expect(out.evidence.headlinesConsidered).toBe(2);
    expect(out.evidence.bullishCount).toBe(2);
    expect(out.evidence.netSentimentScore).toBe(1);
  });
});

describe("SentimentAgent — Error Recovery & Retries", () => {
  it("retries once on invalid schema and falls back gracefully", async () => {
    const invalidPayload = { agent: "sentiment", direction: "invalid_direction", confidence: 5 };
    const { agent, llm, telemetry } = makeAgent([invalidPayload, invalidPayload]);

    const news = [makeNewsItem("1", "Apple news headline")];
    const out = await agent.analyze(inputWith({ news }));

    expect(llm.callCount).toBe(2);
    expect(out.direction).toBe("neutral");
    expect(out.confidence).toBe(0);

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.fallbackCount).toBe(1);
    expect(snapshot.invalidSchemaCount).toBe(2);
  });

  it("recovers on retry if second attempt succeeds", async () => {
    const invalidPayload = { broken: true };
    const validPayload = obedientReply("bullish", 0.75);

    const { agent, llm } = makeAgent([invalidPayload, validPayload]);
    const news = [makeNewsItem("1", "Apple stock gains on revenue beat")];

    const out = await agent.analyze(inputWith({ news }));
    expect(llm.callCount).toBe(2);
    expect(out.direction).toBe("bullish");
  });
});

describe("Sentiment Classification & Keyword Lexicon", () => {
  it("classifies bullish, bearish, and neutral headlines accurately", () => {
    const bullishRes = classifyHeadlines([
      "Company reports surge in profits and raises outlook",
      "Analyst upgrades stock to buy following record revenue",
    ]);
    expect(bullishRes.direction).toBe("bullish");
    expect(bullishRes.netScore).toBe(1);
    expect(bullishRes.bullishCount).toBe(2);

    const bearishRes = classifyHeadlines([
      "Shares plunge following severe revenue miss and profit warning",
      "Company hit with federal investigation and downgrade",
    ]);
    expect(bearishRes.direction).toBe("bearish");
    expect(bearishRes.netScore).toBe(-1);
    expect(bearishRes.bearishCount).toBe(2);

    const neutralRes = classifyHeadlines([
      "Company to hold annual shareholder meeting on Tuesday",
    ]);
    expect(neutralRes.direction).toBe("neutral");
    expect(neutralRes.neutralCount).toBe(1);
  });
});

describe("News Providers", () => {
  it("InMemoryNewsProvider filters by symbol and decisionTs", async () => {
    const provider = new InMemoryNewsProvider([
      makeNewsItem("1", "AAPL news", "2026-03-09T12:00:00.000Z", "AAPL"),
      makeNewsItem("2", "MSFT news", "2026-03-09T12:00:00.000Z", "MSFT"),
      makeNewsItem("3", "AAPL future news", "2026-03-15T12:00:00.000Z", "AAPL"),
    ]);

    const results = await provider.getNews({
      symbol: "AAPL",
      decisionTs: DECISION_TS,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("1");
  });
});
