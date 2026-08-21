import { EventEmitter } from "node:events";
import type { PriceBar, MarketStreamMessage } from "@committee/contracts";
import { loadFixture } from "@committee/fixtures";

export interface StreamClientOptions {
  apiKey?: string;
  apiSecret?: string;
  feedUrl?: string;
  symbols?: string[];
}

export interface IStreamClient extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(symbols: string[]): void;
  isConnected(): boolean;
}

/**
 * Live Alpaca Market Data WebSocket client.
 * Connects to wss://stream.data.alpaca.markets/v2/iex (or sip) using Node 22 native WebSocket.
 */
export class AlpacaWebSocketClient extends EventEmitter implements IStreamClient {
  private ws: WebSocket | null = null;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly feedUrl: string;
  private activeSymbols: Set<string>;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: StreamClientOptions) {
    super();
    this.apiKey = options.apiKey ?? "";
    this.apiSecret = options.apiSecret ?? "";
    this.feedUrl = options.feedUrl ?? "wss://stream.data.alpaca.markets/v2/iex";
    this.activeSymbols = new Set(options.symbols ?? ["AAPL", "NVDA", "SPY"]);
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Missing Alpaca API credentials for live WebSocket streaming.");
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.feedUrl);

        this.ws.onopen = () => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const authMsg = {
              action: "auth",
              key: this.apiKey,
              secret: this.apiSecret,
            };
            this.ws.send(JSON.stringify(authMsg));
          }
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleRawMessage(event.data.toString(), resolve, reject);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit("disconnected");
          this.scheduleReconnect();
        };

        this.ws.onerror = (event: Event) => {
          const err = new Error(`WebSocket stream error: ${String(event)}`);
          this.emit("error", err);
          if (!this.connected) reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleRawMessage(raw: string, onAuthSuccess?: () => void, onAuthFail?: (err: Error) => void) {
    try {
      const messages = JSON.parse(raw);
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        if (msg.T === "success" && msg.msg === "authenticated") {
          this.connected = true;
          this.emit("authenticated");
          if (onAuthSuccess) onAuthSuccess();
          this.sendSubscription();
        } else if (msg.T === "error") {
          const err = new Error(`Alpaca Stream Error [code ${msg.code}]: ${msg.msg}`);
          this.emit("error", err);
          if (onAuthFail) onAuthFail(err);
        } else if (msg.T === "b") {
          // Alpaca Bar message
          const bar: PriceBar = {
            symbol: msg.S,
            timeframe: "1Hour",
            ts: msg.t,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            close: msg.c,
            volume: msg.v,
            asOf: msg.t,
          };

          const streamMsg: MarketStreamMessage = {
            type: "bar",
            symbol: msg.S,
            price: msg.c,
            volume: msg.v,
            bar,
            timestamp: msg.t,
          };

          this.emit("message", streamMsg);
        } else if (msg.T === "q" || msg.T === "t") {
          // Quote or Trade
          const price = msg.p ?? (msg.bp + msg.ap) / 2;
          const streamMsg: MarketStreamMessage = {
            type: "quote",
            symbol: msg.S,
            price,
            volume: msg.s ?? 0,
            timestamp: msg.t,
          };
          this.emit("message", streamMsg);
        }
      }
    } catch {
      // Ignored malformed chunk
    }
  }

  subscribe(symbols: string[]): void {
    for (const sym of symbols) {
      this.activeSymbols.add(sym.toUpperCase());
    }
    if (this.isConnected()) {
      this.sendSubscription();
    }
  }

  private sendSubscription(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const subMsg = {
      action: "subscribe",
      bars: Array.from(this.activeSymbols),
      trades: Array.from(this.activeSymbols),
    };
    this.ws.send(JSON.stringify(subMsg));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {});
    }, 5000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connected = false;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Deterministic Mock Market Stream Client ($0.00 / Zero-Credential Offline Fallback).
 * Replays or synthesizes real-time ticks using the frozen fixture dataset.
 */
export class MockMarketStreamClient extends EventEmitter implements IStreamClient {
  private connected = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private activeSymbols: string[];
  private priceState: Map<string, number> = new Map();

  constructor(symbols: string[] = ["AAPL", "NVDA", "SPY"]) {
    super();
    this.activeSymbols = symbols.map((s) => s.toUpperCase());

    // Initialize baseline prices from fixtures
    for (const sym of this.activeSymbols) {
      try {
        const fixture = loadFixture(sym);
        const lastBar = fixture.bars[fixture.bars.length - 1];
        if (lastBar) {
          this.priceState.set(sym, lastBar.close);
        }
      } catch {
        this.priceState.set(sym, 150.0);
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.emit("authenticated");

    // Emit simulated market ticks / bars every 3 seconds
    this.intervalTimer = setInterval(() => {
      this.emitSimulatedTick();
    }, 3000);
  }

  private emitSimulatedTick(): void {
    if (!this.connected) return;

    for (const sym of this.activeSymbols) {
      const currentPrice = this.priceState.get(sym) ?? 150.0;
      // Slight random walk simulation (-0.2% to +0.2%)
      const deltaPct = (Math.random() - 0.49) * 0.004;
      const newPrice = Number((currentPrice * (1 + deltaPct)).toFixed(2));
      this.priceState.set(sym, newPrice);

      const now = new Date().toISOString();
      const bar: PriceBar = {
        symbol: sym,
        timeframe: "1Hour",
        ts: now,
        open: currentPrice,
        high: Math.max(currentPrice, newPrice) + 0.1,
        low: Math.min(currentPrice, newPrice) - 0.1,
        close: newPrice,
        volume: Math.floor(1000 + Math.random() * 5000),
        asOf: now,
      };

      const streamMsg: MarketStreamMessage = {
        type: "bar",
        symbol: sym,
        price: newPrice,
        volume: bar.volume,
        bar,
        timestamp: now,
      };

      this.emit("message", streamMsg);
    }
  }

  subscribe(symbols: string[]): void {
    for (const sym of symbols) {
      const s = sym.toUpperCase();
      if (!this.activeSymbols.includes(s)) {
        this.activeSymbols.push(s);
        this.priceState.set(s, 150.0);
      }
    }
  }

  disconnect(): void {
    this.connected = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
