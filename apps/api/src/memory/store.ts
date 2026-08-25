import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type {
  EpisodicReflection,
  LongTermMemoryItem,
  MemoryContext,
  ShortTermDecisionItem,
  ShortTermMemory,
} from "@committee/contracts";
import {
  FROZEN_EPISODIC_REFLECTIONS,
  FROZEN_LONG_TERM_MEMORY,
  TemporalGuard,
} from "@committee/fixtures";
import { memoryLongTerm } from "@committee/db/schema";
import { getDb } from "../auth/db.js";

export interface MemoryStoreOptions {
  deterministicOffline?: boolean;
  initialLongTerm?: LongTermMemoryItem[];
  initialReflections?: EpisodicReflection[];
  initialShortTerm?: ShortTermDecisionItem[];
}

export interface MemoryQueryOptions {
  symbol: string;
  asOf: string | Date;
  limitShortTerm?: number;
  limitReflections?: number;
  limitLongTerm?: number;
  categoryFilter?: LongTermMemoryItem["category"];
  queryEmbedding?: number[];
  queryText?: string;
}

/**
 * Computes cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates a deterministic normalized 1536-dimensional float vector from text.
 * Used for zero-cost offline benchmark replays, semantic ranking, and test suites.
 */
export function generateDeterministicEmbedding(text: string, dimensions = 1536): number[] {
  const vec: number[] = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  for (let w = 0; w < words.length; w++) {
    const word = words[w] ?? "";
    const hash = createHash("sha256").update(`${word}-${w}`).digest();
    for (let i = 0; i < 16; i++) {
      const idx = (hash[i]! * 31 + i * 97) % dimensions;
      const val = ((hash[(i + 16) % 32]! - 128) / 128.0);
      vec[idx] = (vec[idx] ?? 0) + val;
    }
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += (vec[i] ?? 0) * (vec[i] ?? 0);
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = (vec[i] ?? 0) / norm;
    }
  }

  return vec;
}

/**
 * MemoryStore manages the 3-tier memory system:
 * 1. Short-Term Working Memory (recent trades & consensus decisions)
 * 2. Long-Term Semantic Knowledge (company facts, risk rules, guidelines)
 * 3. Episodic Post-Trade Reflections (critiques & lessons learned)
 *
 * Enforces strict point-in-time isolation: ALL lookups filter on `as_of <= decision_ts`.
 */
export class MemoryStore {
  public readonly deterministicOffline: boolean;
  private shortTermItems: ShortTermDecisionItem[] = [];
  private longTermItems: LongTermMemoryItem[] = [];
  private reflectionItems: EpisodicReflection[] = [];

  constructor(options: MemoryStoreOptions = {}) {
    this.deterministicOffline = options.deterministicOffline ?? true;

    if (options.initialLongTerm) {
      this.longTermItems = [...options.initialLongTerm];
    } else if (this.deterministicOffline) {
      // Hydrate with deterministic embeddings if not present
      this.longTermItems = FROZEN_LONG_TERM_MEMORY.map((item) => ({
        ...item,
        embedding: item.embedding ?? generateDeterministicEmbedding(`${item.title} ${item.content}`),
      }));
    }

    if (options.initialReflections) {
      this.reflectionItems = [...options.initialReflections];
    } else if (this.deterministicOffline) {
      this.reflectionItems = [...FROZEN_EPISODIC_REFLECTIONS];
    }

    if (options.initialShortTerm) {
      this.shortTermItems = [...options.initialShortTerm];
    }
  }

  /**
   * Save a decision outcome to short-term working memory.
   */
  public recordShortTermDecision(item: Omit<ShortTermDecisionItem, "id"> & { id?: string }): ShortTermDecisionItem {
    const record: ShortTermDecisionItem = {
      id: item.id ?? randomUUID(),
      decisionTs: item.decisionTs,
      symbol: item.symbol,
      direction: item.direction,
      confidence: item.confidence,
      rationale: item.rationale,
      asOf: item.asOf,
    };
    this.shortTermItems.push(record);
    return record;
  }

  /**
   * Add a long-term memory item (e.g. company facts or risk rules).
   */
  public recordLongTermItem(item: Omit<LongTermMemoryItem, "id"> & { id?: string }): LongTermMemoryItem {
    const embedding = item.embedding ?? generateDeterministicEmbedding(`${item.title} ${item.content}`);
    const record: LongTermMemoryItem = {
      id: item.id ?? randomUUID(),
      category: item.category,
      symbol: item.symbol ?? null,
      title: item.title,
      content: item.content,
      tags: item.tags ?? [],
      embedding,
      metadata: item.metadata ?? {},
      asOf: item.asOf,
    };
    this.longTermItems.push(record);
    return record;
  }

  /**
   * Save an episodic post-trade reflection.
   */
  public recordReflection(reflection: Omit<EpisodicReflection, "id"> & { id?: string }): EpisodicReflection {
    const record: EpisodicReflection = {
      id: reflection.id ?? randomUUID(),
      symbol: reflection.symbol,
      tradeId: reflection.tradeId,
      decisionTs: reflection.decisionTs,
      reviewTs: reflection.reviewTs,
      initialDirection: reflection.initialDirection,
      initialConfidence: reflection.initialConfidence,
      outcomeReturnPct: reflection.outcomeReturnPct,
      holdingBars: reflection.holdingBars,
      critique: reflection.critique,
      lessonLearned: reflection.lessonLearned,
      contradictionDetected: reflection.contradictionDetected ?? false,
      contradictionDetails: reflection.contradictionDetails,
      asOf: reflection.asOf,
    };
    this.reflectionItems.push(record);
    return record;
  }

  /**
   * Executes pgvector semantic similarity search in PostgreSQL if connected.
   */
  public async queryVectorMemoryFromDb(
    queryVector: number[],
    asOf: string,
    limit: number = 5,
    symbol?: string,
  ): Promise<LongTermMemoryItem[]> {
    try {
      const db = await getDb();
      const asOfDate = new Date(asOf);
      const vectorStr = JSON.stringify(queryVector);

      // Cosine distance in pgvector: <=>
      const results = await db
        .select({
          id: memoryLongTerm.id,
          category: memoryLongTerm.category,
          symbol: memoryLongTerm.symbol,
          title: memoryLongTerm.title,
          content: memoryLongTerm.content,
          tags: memoryLongTerm.tags,
          embedding: memoryLongTerm.embedding,
          metadata: memoryLongTerm.metadata,
          asOf: memoryLongTerm.asOf,
        })
        .from(memoryLongTerm)
        .where(
          sql`${memoryLongTerm.asOf} <= ${asOfDate} AND (${memoryLongTerm.symbol} IS NULL OR ${memoryLongTerm.symbol} = ${symbol ?? ""})`
        )
        .orderBy(sql`${memoryLongTerm.embedding} <=> ${vectorStr}::vector`)
        .limit(limit);

      return results.map((r) => ({
        id: r.id,
        category: r.category as LongTermMemoryItem["category"],
        symbol: r.symbol,
        title: r.title,
        content: r.content,
        tags: r.tags,
        embedding: r.embedding ?? undefined,
        metadata: r.metadata,
        asOf: r.asOf.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Point-in-time retrieval of unified MemoryContext for an agent decision cycle.
   */
  public queryMemoryContext(query: MemoryQueryOptions): MemoryContext {
    const asOfStr = typeof query.asOf === "string" ? query.asOf : query.asOf.toISOString();
    const symbol = query.symbol.toUpperCase();

    // 1. Query Short-Term Memory up to asOf
    const filteredStm = TemporalGuard.filter(this.shortTermItems, asOfStr)
      .filter((item) => item.symbol.toUpperCase() === symbol)
      .sort((a, b) => Date.parse(b.decisionTs) - Date.parse(a.decisionTs))
      .slice(0, query.limitShortTerm ?? 5);

    const shortTerm: ShortTermMemory = {
      asOf: asOfStr,
      recentDecisions: filteredStm,
    };

    // 2. Query Long-Term Memory up to asOf
    let filteredLtm = TemporalGuard.queryLongTermMemory(this.longTermItems, asOfStr).filter(
      (item) => !item.symbol || item.symbol.toUpperCase() === symbol,
    );

    if (query.categoryFilter) {
      filteredLtm = filteredLtm.filter((item) => item.category === query.categoryFilter);
    }

    // Resolve target vector for semantic search
    const targetVec = query.queryEmbedding ?? (query.queryText ? generateDeterministicEmbedding(query.queryText) : undefined);

    // Rank by vector similarity if target embedding is available
    if (targetVec && targetVec.length > 0) {
      filteredLtm = [...filteredLtm].sort((a, b) => {
        const simA = a.embedding ? cosineSimilarity(targetVec, a.embedding) : 0;
        const simB = b.embedding ? cosineSimilarity(targetVec, b.embedding) : 0;
        return simB - simA;
      });
    }

    const longTerm = filteredLtm.slice(0, query.limitLongTerm ?? 5);

    // 3. Query Episodic Reflections up to asOf
    let filteredReflections = TemporalGuard.queryReflections(this.reflectionItems, asOfStr).filter(
      (item) => item.symbol.toUpperCase() === symbol,
    );

    if (targetVec && targetVec.length > 0) {
      filteredReflections = [...filteredReflections].sort((a, b) => {
        const embA = generateDeterministicEmbedding(`${a.critique} ${a.lessonLearned}`);
        const embB = generateDeterministicEmbedding(`${b.critique} ${b.lessonLearned}`);
        const simA = cosineSimilarity(targetVec, embA);
        const simB = cosineSimilarity(targetVec, embB);
        return simB - simA;
      });
    } else {
      filteredReflections.sort((a, b) => Date.parse(b.asOf) - Date.parse(a.asOf));
    }

    const reflections = filteredReflections.slice(0, query.limitReflections ?? 3);

    return {
      asOf: asOfStr,
      shortTerm,
      longTerm,
      reflections,
    };
  }
}

