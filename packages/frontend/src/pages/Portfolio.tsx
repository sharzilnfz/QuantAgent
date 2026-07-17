import { useEffect, useState } from "react";
import { fetchApi } from "../lib/api";
import { Settings, Save, AlertCircle } from "lucide-react";

interface PortfolioData {
  cash: number;
  equity: number;
  buyingPower: number;
  portfolioValue: number;
  pnl: number;
  positions: {
    symbol: string;
    qty: number;
    avgEntryPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPl: number;
    unrealizedPlPct: number;
    side: string;
  }[];
}

export function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showConfig, setShowConfig] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchApi("/portfolio");
      setData(result);
      setShowConfig(false);
    } catch (err: any) {
      setError(err.message || "Failed to load portfolio");
      if (err.status === 400 && err.data?.error?.includes("Alpaca credentials")) {
        setShowConfig(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    try {
      await fetchApi("/credentials/alpaca", {
        method: "PUT",
        body: JSON.stringify({ apiKey, apiSecret, isPaper: true }),
      });
      await loadPortfolio();
    } catch (err: any) {
      setError(err.message || "Failed to save keys");
    } finally {
      setSavingKeys(false);
    }
  };

  if (loading && !data && !showConfig) {
    return <div className="text-center py-12 text-surface-400">Loading portfolio...</div>;
  }

  if (showConfig) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 text-xl font-medium mb-6">
            <Settings className="text-primary-400" />
            Configure Alpaca Paper Account
          </div>
          
          <p className="text-surface-400 text-sm mb-6">
            To view your portfolio and paper trade, you need to provide your Alpaca Paper API keys.
            These are encrypted at rest and never exposed to the client again.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-md mb-6 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSaveKeys} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">API Key ID</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-surface-800/50 border border-surface-700 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-primary-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Secret Key</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full bg-surface-800/50 border border-surface-700 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-primary-500/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingKeys}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-medium py-2.5 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {savingKeys ? "Saving..." : "Save Credentials"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPositive = data.pnl >= 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-2xl font-semibold">Portfolio Overview</h1>
        <button 
          onClick={() => setShowConfig(true)}
          className="text-sm text-surface-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <Settings size={14} /> Reconfigure Keys
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="text-sm text-surface-400 mb-1">Equity</div>
          <div className="text-3xl font-medium">${data.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="glass-card p-6">
          <div className="text-sm text-surface-400 mb-1">Cash / Buying Power</div>
          <div className="text-3xl font-medium">${data.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="glass-card p-6">
          <div className="text-sm text-surface-400 mb-1">Unrealized P&L</div>
          <div className={`text-3xl font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800">
          <h2 className="text-lg font-medium">Open Positions</h2>
        </div>
        
        {data.positions.length === 0 ? (
          <div className="p-12 text-center text-surface-400">
            No open positions. Use the Watchlist to analyze assets and paper trade.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-800/30 text-surface-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium text-right">Qty</th>
                  <th className="px-6 py-3 font-medium text-right">Avg Entry</th>
                  <th className="px-6 py-3 font-medium text-right">Current</th>
                  <th className="px-6 py-3 font-medium text-right">Market Value</th>
                  <th className="px-6 py-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {data.positions.map((p) => {
                  const pnlPos = p.unrealizedPl >= 0;
                  return (
                    <tr key={p.symbol} className="hover:bg-surface-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium">{p.symbol}</td>
                      <td className="px-6 py-4 text-right">{p.qty}</td>
                      <td className="px-6 py-4 text-right">${p.avgEntryPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">${p.currentPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">${p.marketValue.toFixed(2)}</td>
                      <td className={`px-6 py-4 text-right ${pnlPos ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlPos ? '+' : ''}${p.unrealizedPl.toFixed(2)} 
                        <span className="text-xs ml-1 opacity-75">
                          ({(p.unrealizedPlPct * 100).toFixed(2)}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
