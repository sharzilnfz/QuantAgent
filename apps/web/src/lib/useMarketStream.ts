import { useEffect, useState, useRef } from "react";
import type { MarketStreamMessage } from "@committee/contracts";

export interface UseMarketStreamOptions {
  symbols?: string[];
  enabled?: boolean;
}

export function useMarketStream(options: UseMarketStreamOptions = {}) {
  const { symbols = ["AAPL", "NVDA", "SPY"], enabled = true } = options;
  const [lastMessage, setLastMessage] = useState<MarketStreamMessage | null>(null);
  const [messagesBySymbol, setMessagesBySymbol] = useState<Record<string, MarketStreamMessage>>({});
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnected(false);
      }
      return;
    }

    const query = symbols.length > 0 ? `?symbols=${encodeURIComponent(symbols.join(","))}` : "";
    const url = `/api/streaming/market-data${query}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as MarketStreamMessage;
          setLastMessage(msg);
          if (msg.symbol && msg.symbol !== "SYSTEM") {
            setMessagesBySymbol((prev) => ({
              ...prev,
              [msg.symbol.toUpperCase()]: msg,
            }));
          }
        } catch {
          // Ignore keep-alive or malformed data
        }
      };

      es.onerror = () => {
        setConnected(false);
      };

      return () => {
        es.close();
        eventSourceRef.current = null;
        setConnected(false);
      };
    } catch {
      setConnected(false);
    }
  }, [enabled, symbols.join(",")]);

  return {
    connected,
    lastMessage,
    messagesBySymbol,
  };
}
