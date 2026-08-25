/**
 * React Query wiring: one place for query keys, cache policy, and the hooks
 * components consume. Keeping keys here means an invalidation is never a
 * stringly-typed guess at a call site.
 */
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, isUnauthorized } from "./api";
import type { AuthUser } from "./api";
import type { DaemonConfig } from "@committee/contracts";

export const queryKeys = {
  session: ["auth", "me"] as const,
  portfolio: ["portfolio"] as const,
  portfolioHistory: ["portfolio", "history"] as const,
  watchlist: ["watchlist"] as const,
  latestAgentOutput: (symbol: string) => ["agents", "latest", symbol] as const,
  experimentsSuite: (symbol: string) => ["experiments", "suite", symbol] as const,
  multiAssetExperimentsSuite: (universe: string[]) => ["experiments", "multi-asset", "suite", universe.join(",")] as const,
  varianceSweep: (symbol: string, windowSize: number, runs: number, budget: number) =>
    ["experiments", "variance-sweep", symbol, windowSize, runs, budget] as const,
  agentConfig: ["agents", "config"] as const,
  signalsRadar: (symbols?: string[]) => ["signals", "radar", symbols?.join(",") ?? "default"] as const,
  daemonStatus: ["daemon", "status"] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A 401 is an answer, not a flake — retrying it just delays the
        // redirect to /login. Everything else gets one retry.
        retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/** The session query. Runs on boot, which is what survives a hard reload. */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => api.me(signal),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => api.login(credentials),
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(queryKeys.session, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) => api.register(credentials),
    onSuccess: (user: AuthUser) => {
      queryClient.setQueryData(queryKeys.session, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: ({ signal }) => api.portfolio(signal),
  });
}

export function usePortfolioHistory() {
  return useQuery({
    queryKey: queryKeys.portfolioHistory,
    queryFn: ({ signal }) => api.portfolioHistory(signal),
    // If the backend has no history route, fail softly (empty chart).
    retry: false,
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: ({ signal }) => api.watchlist(signal),
  });
}

export function useLatestAgentOutput(symbol: string | undefined) {
  return useQuery({
    queryKey: queryKeys.latestAgentOutput(symbol ?? ""),
    queryFn: ({ signal }) => api.latestAgentOutput(symbol as string, signal),
    enabled: Boolean(symbol),
  });
}

export function useExperimentSuite(symbol: string = "AAPL") {
  return useQuery({
    queryKey: queryKeys.experimentsSuite(symbol),
    queryFn: ({ signal }) => api.experimentsSuite(symbol, signal),
    retry: false,
  });
}

export function useMultiAssetExperimentSuite(universe: string[] = ["AAPL", "NVDA", "SPY"], enabled = true) {
  return useQuery({
    queryKey: queryKeys.multiAssetExperimentsSuite(universe),
    queryFn: ({ signal }) => api.multiAssetExperimentsSuite(universe, signal),
    enabled,
    retry: false,
  });
}

export function useVarianceSweep(
  symbol: string = "AAPL",
  windowSize = 25,
  runs = 3,
  budget = 5.0,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.varianceSweep(symbol, windowSize, runs, budget),
    queryFn: ({ signal }) => api.varianceSweep(symbol, windowSize, runs, budget, signal),
    enabled,
    retry: false,
  });
}

export function useAgentConfig() {
  return useQuery({
    queryKey: queryKeys.agentConfig,
    queryFn: ({ signal }) => api.getAgentConfig(signal),
  });
}

export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Parameters<typeof api.updateAgentConfig>[0]) => api.updateAgentConfig(config),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.agentConfig, updated);
    },
  });
}

export function useResetAgentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetAgentConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentConfig });
    },
  });
}

export function useSignalsRadar(symbols?: string[]) {
  return useQuery({
    queryKey: queryKeys.signalsRadar(symbols),
    queryFn: ({ signal }) => api.getSignalsRadar(symbols, signal),
    refetchInterval: 15_000,
  });
}

export function useEvaluateSignalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { symbol: string; decisionTs?: string; debateEnabled?: boolean }) =>
      api.evaluateSignal(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals", "radar"] });
    },
  });
}

export function useDaemonStatus() {
  return useQuery({
    queryKey: queryKeys.daemonStatus,
    queryFn: ({ signal }) => api.getDaemonStatus(signal),
    refetchInterval: 5_000,
  });
}

export function useStartDaemonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.startDaemon(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.daemonStatus, data);
    },
  });
}

export function useStopDaemonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.stopDaemon(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.daemonStatus, data);
    },
  });
}

export function useRunDaemonCycleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.runDaemonCycle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daemonStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio });
      queryClient.invalidateQueries({ queryKey: ["signals", "radar"] });
    },
  });
}

export function useUpdateDaemonConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<DaemonConfig>) => api.updateDaemonConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.daemonStatus });
    },
  });
}
