import { EventEmitter } from "node:events";
import type { MarketStreamMessage, PriceBar, IndicatorSnapshot } from "@committee/contracts";
import { computeIndicatorSnapshots } from "../indicators/index.js";
import { loadFixture } from "@committee/fixtures";
import { AlpacaWebSocketClient, MockMarketStreamClient, type IStreamClient } from "./alpaca-stream.js";
import { config } from "../config.js";

export class MarketStreamEngine extends EventEmitter {
  private client: IStreamClient;
  private barHistory: Map<string, PriceBar[]> = new Map();
  private isLive = false;

  constructor(customClient?: IStreamClient) {
    super();

    if (customClient) {
      this.client = customClient;
    } else if (process.env.NODE_ENV !== "test" && !process.env.VITEST && config.ALPACA_KEY && config.ALPACA_SECRET) {
      this.client = new AlpacaWebSocketClient({
        apiKey: config.ALPACA_KEY,
        apiSecret: config.ALPACA_SECRET,
        feedUrl: "wss://stream.data.alpaca.markets/v2/iex",
        symbols: ["AAPL", "NVDA", "SPY"],
      });
    } else {
      // Zero-credential offline fallback
      this.client = new MockMarketStreamClient(["AAPL", "NVDA", "SPY"]);
    }

    this.initializeHistories(["AAPL", "NVDA", "SPY"]);
    this.bindEvents();
    // Default error listener to avoid uncaught exception on emitter
    this.on("error", () => {});
  }

  private initializeHistories(symbols: string[]) {
    for (const sym of symbols) {
      try {
        const fixture = loadFixture(sym);
        // Seed initial history from fixture bars (last 100 bars for warm indicators)
        this.barHistory.set(sym.toUpperCase(), fixture.bars.slice(-100));
      } catch {
        this.barHistory.set(sym.toUpperCase(), []);
      }
    }
  }

  private bindEvents() {
    this.client.on("message", (msg: MarketStreamMessage) => {
      if (msg.type === "bar" && msg.bar) {
        const sym = msg.symbol.toUpperCase();
        const history = this.barHistory.get(sym) ?? [];
        history.push(msg.bar);
        if (history.length > 200) history.shift();
        this.barHistory.set(sym, history);

        // Compute real-time indicator snapshot
        let latestIndicators: IndicatorSnapshot | undefined = undefined;
        try {
          const snapshots = computeIndicatorSnapshots(history);
          latestIndicators = snapshots[snapshots.length - 1] ?? undefined;
        } catch {
          // Keep null if lookback window is not satisfied
        }

        const enrichedMessage: MarketStreamMessage = {
          ...msg,
          indicators: latestIndicators,
        };

        this.emit("data", enrichedMessage);
      } else {
        this.emit("data", msg);
      }
    });

    this.client.on("error", (err) => {
      this.emit("error", err);
    });
  }

  async start(): Promise<void> {
    if (this.isLive) return;
    await this.client.connect();
    this.isLive = true;
  }

  stop(): void {
    if (!this.isLive) return;
    this.client.disconnect();
    this.isLive = false;
  }

  subscribe(symbols: string[]): void {
    for (const s of symbols) {
      const sym = s.toUpperCase();
      if (!this.barHistory.has(sym)) {
        try {
          const fixture = loadFixture(sym);
          this.barHistory.set(sym, fixture.bars.slice(-100));
        } catch {
          this.barHistory.set(sym, []);
        }
      }
    }
    this.client.subscribe(symbols);
  }

  getBarHistory(symbol: string): PriceBar[] {
    return this.barHistory.get(symbol.toUpperCase()) ?? [];
  }

  getLatestIndicators(symbol: string): IndicatorSnapshot | undefined {
    const history = this.barHistory.get(symbol.toUpperCase()) ?? [];
    if (history.length === 0) return undefined;
    const snapshots = computeIndicatorSnapshots(history);
    return snapshots[snapshots.length - 1] ?? undefined;
  }

  isRunning(): boolean {
    return this.isLive;
  }
}

let instance: MarketStreamEngine | null = null;

export function getStreamEngine(): MarketStreamEngine {
  if (!instance) {
    instance = new MarketStreamEngine();
  }
  return instance;
}
