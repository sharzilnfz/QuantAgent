import { config } from "../config.js";
import { createModuleLogger } from "./logger.js";

const logger = createModuleLogger("alpaca");

/**
 * Lightweight Alpaca REST client.
 *
 * Uses user-specific decrypted API keys to call:
 * - Trading API (account, positions, orders)
 * - Market Data API (historical bars)
 *
 * All external calls are logged for observability. In tests, consumers
 * inject a mock fetch or stub this module entirely.
 */

export interface AlpacaClientOptions {
  apiKey: string;
  apiSecret: string;
  isPaper?: boolean;
}

interface AlpacaBar {
  t: string; // RFC-3339 timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaBarsResponse {
  bars: AlpacaBar[];
  next_page_token: string | null;
}

interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: string;
}

interface AlpacaAccount {
  id: string;
  cash: string;
  equity: string;
  buying_power: string;
  portfolio_value: string;
  status: string;
}

/**
 * Create an Alpaca REST client for a specific user's keys.
 */
export function createAlpacaClient(opts: AlpacaClientOptions) {
  const baseUrl = config.ALPACA_BASE_URL;
  const dataUrl = config.ALPACA_DATA_URL;

  const headers = {
    "APCA-API-KEY-ID": opts.apiKey,
    "APCA-API-SECRET-KEY": opts.apiSecret,
    "Content-Type": "application/json",
  };

  async function apiCall<T>(url: string, label: string): Promise<T> {
    logger.debug({ url, label }, "Alpaca API call");

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ url, status: res.status, body, label }, "Alpaca API error");
      throw new Error(`Alpaca ${label} failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<T>;
  }

  return {
    /**
     * Get the user's Alpaca account info.
     */
    async getAccount(): Promise<AlpacaAccount> {
      return apiCall<AlpacaAccount>(`${baseUrl}/v2/account`, "getAccount");
    },

    /**
     * Get all open positions.
     */
    async getPositions(): Promise<AlpacaPosition[]> {
      return apiCall<AlpacaPosition[]>(
        `${baseUrl}/v2/positions`,
        "getPositions"
      );
    },

    /**
     * Fetch historical OHLCV bars from Alpaca's market data API.
     * Handles pagination via next_page_token.
     */
    async getBars(
      symbol: string,
      timeframe: string,
      start: string,
      end: string,
      limit: number = 1000
    ): Promise<AlpacaBar[]> {
      const allBars: AlpacaBar[] = [];
      let pageToken: string | null = null;

      do {
        const params = new URLSearchParams({
          start,
          end,
          timeframe,
          limit: String(limit),
          adjustment: "split",
        });
        if (pageToken) params.set("page_token", pageToken);

        const url = `${dataUrl}/v2/stocks/${symbol}/bars?${params}`;
        const data = await apiCall<AlpacaBarsResponse>(url, "getBars");

        allBars.push(...data.bars);
        pageToken = data.next_page_token;
      } while (pageToken);

      logger.info(
        { symbol, timeframe, count: allBars.length },
        "Bars fetched from Alpaca"
      );

      return allBars;
    },
  };
}

export type AlpacaClient = ReturnType<typeof createAlpacaClient>;
