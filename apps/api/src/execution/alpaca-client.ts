import { randomUUID } from "node:crypto";
import {
  OrderRequest,
  OrderResult,
  type OrderStatus,
} from "@committee/contracts";

export interface AlpacaAccount {
  id: string;
  cash: number;
  portfolioValue: number;
  equity: number;
  buyingPower: number;
  status: string;
  currency: string;
}

export interface AlpacaPosition {
  symbol: string;
  qty: number;
  marketValue: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPl: number;
}

export interface IAlpacaClient {
  getAccount(): Promise<AlpacaAccount>;
  getPositions(): Promise<AlpacaPosition[]>;
  placeOrder(req: OrderRequest): Promise<OrderResult>;
  getOrder(orderId: string): Promise<OrderResult>;
  listOrders(status?: string): Promise<OrderResult[]>;
}

export interface AlpacaClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

export class AlpacaPaperClient implements IAlpacaClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor(config: AlpacaClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl ?? "https://paper-api.alpaca.markets/v2";
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.apiSecret,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(5000),
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Alpaca API error: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }

    return (await res.json()) as T;
  }

  async getAccount(): Promise<AlpacaAccount> {
    const raw = await this.request<{
      id: string;
      cash: string;
      portfolio_value: string;
      equity: string;
      buying_power: string;
      status: string;
      currency: string;
    }>("/account");

    const cash = parseFloat(raw.cash) || 0;
    const equity = parseFloat(raw.equity) || cash;
    const portfolioValue = parseFloat(raw.portfolio_value) || equity;
    const buyingPower = parseFloat(raw.buying_power) || cash;

    return {
      id: raw.id,
      cash,
      portfolioValue,
      equity,
      buyingPower,
      status: raw.status,
      currency: raw.currency ?? "USD",
    };
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    const raw = await this.request<
      Array<{
        symbol: string;
        qty: string;
        market_value: string;
        avg_entry_price: string;
        current_price: string;
        unrealized_pl: string;
      }>
    >("/positions");

    return raw.map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty) || 0,
      marketValue: parseFloat(p.market_value) || 0,
      avgEntryPrice: parseFloat(p.avg_entry_price) || 0,
      currentPrice: parseFloat(p.current_price) || 0,
      unrealizedPl: parseFloat(p.unrealized_pl) || 0,
    }));
  }

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const clientOrderId = req.clientOrderId ?? `comm-${randomUUID().slice(0, 12)}`;
    const payload: Record<string, unknown> = {
      symbol: req.symbol,
      qty: String(req.qty),
      side: req.side,
      type: req.type,
      time_in_force: req.timeInForce,
      client_order_id: clientOrderId,
    };

    if (req.limitPrice) {
      payload.limit_price = String(req.limitPrice);
    }

    const raw = await this.request<{
      id: string;
      client_order_id: string;
      symbol: string;
      side: "buy" | "sell";
      qty: string;
      filled_qty: string;
      filled_avg_price: string | null;
      type: "market" | "limit" | "stop" | "stop_limit";
      status: OrderStatus;
      time_in_force: "day" | "gtc" | "ioc" | "fok";
      submitted_at: string;
      filled_at: string | null;
    }>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return OrderResult.parse({
      orderId: raw.id,
      clientOrderId: raw.client_order_id,
      symbol: raw.symbol,
      side: raw.side,
      qty: parseFloat(raw.qty) || req.qty,
      filledQty: parseFloat(raw.filled_qty) || 0,
      filledAvgPrice: raw.filled_avg_price ? parseFloat(raw.filled_avg_price) : null,
      type: raw.type,
      status: raw.status,
      timeInForce: raw.time_in_force,
      submittedAt: raw.submitted_at ?? new Date().toISOString(),
      filledAt: raw.filled_at ?? null,
      rawBrokerResponse: raw as Record<string, unknown>,
    });
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    const raw = await this.request<{
      id: string;
      client_order_id: string;
      symbol: string;
      side: "buy" | "sell";
      qty: string;
      filled_qty: string;
      filled_avg_price: string | null;
      type: "market" | "limit" | "stop" | "stop_limit";
      status: OrderStatus;
      time_in_force: "day" | "gtc" | "ioc" | "fok";
      submitted_at: string;
      filled_at: string | null;
    }>(`/orders/${orderId}`);

    return OrderResult.parse({
      orderId: raw.id,
      clientOrderId: raw.client_order_id,
      symbol: raw.symbol,
      side: raw.side,
      qty: parseFloat(raw.qty) || 0,
      filledQty: parseFloat(raw.filled_qty) || 0,
      filledAvgPrice: raw.filled_avg_price ? parseFloat(raw.filled_avg_price) : null,
      type: raw.type,
      status: raw.status,
      timeInForce: raw.time_in_force,
      submittedAt: raw.submitted_at ?? new Date().toISOString(),
      filledAt: raw.filled_at ?? null,
      rawBrokerResponse: raw as Record<string, unknown>,
    });
  }

  async listOrders(status = "all"): Promise<OrderResult[]> {
    const raw = await this.request<
      Array<{
        id: string;
        client_order_id: string;
        symbol: string;
        side: "buy" | "sell";
        qty: string;
        filled_qty: string;
        filled_avg_price: string | null;
        type: "market" | "limit" | "stop" | "stop_limit";
        status: OrderStatus;
        time_in_force: "day" | "gtc" | "ioc" | "fok";
        submitted_at: string;
        filled_at: string | null;
      }>
    >(`/orders?status=${status}&limit=50`);

    return raw.map((o) =>
      OrderResult.parse({
        orderId: o.id,
        clientOrderId: o.client_order_id,
        symbol: o.symbol,
        side: o.side,
        qty: parseFloat(o.qty) || 0,
        filledQty: parseFloat(o.filled_qty) || 0,
        filledAvgPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
        type: o.type,
        status: o.status,
        timeInForce: o.time_in_force,
        submittedAt: o.submitted_at ?? new Date().toISOString(),
        filledAt: o.filled_at ?? null,
        rawBrokerResponse: o as Record<string, unknown>,
      }),
    );
  }
}

/**
 * Deterministic In-Memory Alpaca Paper Trading Simulator for offline testing and zero-cost demos.
 */
export class DeterministicMockAlpacaClient implements IAlpacaClient {
  private cash: number;
  private positions: Map<string, { qty: number; avgEntryPrice: number; currentPrice: number }>;
  private orders: Map<string, OrderResult>;

  constructor(initialCash = 100000) {
    this.cash = initialCash;
    this.positions = new Map();
    this.orders = new Map();
  }

  async getAccount(): Promise<AlpacaAccount> {
    let positionsValue = 0;
    for (const [, pos] of this.positions) {
      positionsValue += pos.qty * pos.currentPrice;
    }
    const equity = this.cash + positionsValue;

    return {
      id: "mock-account-001",
      cash: this.cash,
      portfolioValue: equity,
      equity,
      buyingPower: this.cash * 2,
      status: "ACTIVE",
      currency: "USD",
    };
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    const result: AlpacaPosition[] = [];
    for (const [symbol, pos] of this.positions) {
      if (pos.qty > 0) {
        const marketValue = pos.qty * pos.currentPrice;
        const costBasis = pos.qty * pos.avgEntryPrice;
        const unrealizedPl = marketValue - costBasis;
        result.push({
          symbol,
          qty: pos.qty,
          marketValue,
          avgEntryPrice: pos.avgEntryPrice,
          currentPrice: pos.currentPrice,
          unrealizedPl,
        });
      }
    }
    return result;
  }

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const orderId = `mock-ord-${randomUUID().slice(0, 8)}`;
    const clientOrderId = req.clientOrderId ?? `mock-client-${randomUUID().slice(0, 8)}`;
    const price = req.limitPrice ?? 180; // default estimated fill price
    const notional = req.qty * price;

    if (req.side === "buy") {
      if (this.cash < notional) {
        const rejectedOrder = OrderResult.parse({
          orderId,
          clientOrderId,
          symbol: req.symbol,
          side: req.side,
          qty: req.qty,
          filledQty: 0,
          type: req.type,
          status: "rejected",
          timeInForce: req.timeInForce,
          submittedAt: new Date().toISOString(),
        });
        this.orders.set(orderId, rejectedOrder);
        return rejectedOrder;
      }

      this.cash -= notional;
      const existing = this.positions.get(req.symbol) ?? { qty: 0, avgEntryPrice: 0, currentPrice: price };
      const newQty = existing.qty + req.qty;
      const newAvgPrice = (existing.qty * existing.avgEntryPrice + notional) / newQty;
      this.positions.set(req.symbol, { qty: newQty, avgEntryPrice: newAvgPrice, currentPrice: price });
    } else {
      // sell
      const existing = this.positions.get(req.symbol);
      const availableQty = existing ? existing.qty : 0;
      const sellQty = Math.min(availableQty, req.qty);

      this.cash += sellQty * price;
      if (existing) {
        existing.qty -= sellQty;
        if (existing.qty <= 0) {
          this.positions.delete(req.symbol);
        }
      }
    }

    const filledOrder = OrderResult.parse({
      orderId,
      clientOrderId,
      symbol: req.symbol,
      side: req.side,
      qty: req.qty,
      filledQty: req.qty,
      filledAvgPrice: price,
      type: req.type,
      status: "filled",
      timeInForce: req.timeInForce,
      submittedAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    });

    this.orders.set(orderId, filledOrder);
    return filledOrder;
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    const ord = this.orders.get(orderId);
    if (!ord) throw new Error(`Order ${orderId} not found`);
    return ord;
  }

  async listOrders(): Promise<OrderResult[]> {
    return Array.from(this.orders.values());
  }

  setMockPrice(symbol: string, price: number): void {
    const pos = this.positions.get(symbol);
    if (pos) {
      pos.currentPrice = price;
    }
  }
}
