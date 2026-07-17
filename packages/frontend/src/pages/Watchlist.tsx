import { useEffect, useState } from "react";
import { fetchApi } from "../lib/api";
import { Search, Plus, Trash2, Activity, ChevronRight } from "lucide-react";

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
}

interface AgentResult {
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  rationale: string;
  features: Record<string, number>;
}

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState("");

  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, AgentResult>>({});

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const data = await fetchApi("/watchlist");
      setItems(data.items);
    } catch (err) {
      console.error("Failed to load watchlist", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol) return;
    setAddError("");

    try {
      await fetchApi("/watchlist", {
        method: "POST",
        body: JSON.stringify({ symbol: newSymbol.toUpperCase() }),
      });
      setNewSymbol("");
      await loadWatchlist();
    } catch (err: any) {
      setAddError(err.message || "Failed to add symbol");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetchApi(`/watchlist/${id}`, { method: "DELETE" });
      setItems(items.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Failed to remove item", err);
    }
  };

  const handleAnalyze = async (symbol: string) => {
    setAnalyzing((prev) => ({ ...prev, [symbol]: true }));
    try {
      // 1. Trigger ingestion (fetches Alpaca bars + computes indicators)
      await fetchApi(`/ingest/${symbol}?timeframe=1D`, { method: "POST" });
      
      // 2. Run technical agent
      const data = await fetchApi("/agents/technical/run", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      });

      setResults((prev) => ({ ...prev, [symbol]: data }));
    } catch (err) {
      console.error(`Analysis failed for ${symbol}`, err);
    } finally {
      setAnalyzing((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Watchlist & Analysis</h1>
      </div>

      <div className="glass-card p-6">
        <form onSubmit={handleAdd} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="Add symbol (e.g., AAPL, MSFT)"
              className="w-full bg-surface-800/50 border border-surface-700 rounded-md py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-500/50 uppercase"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-surface-700 hover:bg-surface-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Plus size={18} /> Add
          </button>
        </form>
        {addError && <p className="text-red-400 text-sm mt-2">{addError}</p>}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-surface-400 py-8">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-surface-400 py-8 glass-card">
            Your watchlist is empty. Add a symbol above to start analyzing.
          </div>
        ) : (
          items.map((item) => {
            const isAnalyzing = analyzing[item.symbol];
            const result = results[item.symbol];

            return (
              <div key={item.id} className="glass-card overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-surface-800/50">
                  <div>
                    <h3 className="text-lg font-medium font-mono">{item.symbol}</h3>
                    <p className="text-sm text-surface-400">{item.name} • {item.exchange}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAnalyze(item.symbol)}
                      disabled={isAnalyzing}
                      className="flex items-center gap-2 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      <Activity size={16} />
                      {isAnalyzing ? "Analyzing..." : "Analyze"}
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {result && (
                  <div className="p-4 bg-surface-800/30">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`px-2 py-1 rounded text-sm font-medium ${
                        result.bias === 'bullish' ? 'bg-green-500/20 text-green-400' :
                        result.bias === 'bearish' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {result.bias.toUpperCase()}
                      </div>
                      <div className="text-sm text-surface-300">
                        Confidence: <span className="text-white">{(result.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-surface-300 leading-relaxed mb-4">
                      {result.rationale}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.features).map(([key, val]) => (
                        <div key={key} className="text-xs bg-surface-800 px-2 py-1 rounded text-surface-400 font-mono">
                          {key}: <span className="text-surface-200">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
