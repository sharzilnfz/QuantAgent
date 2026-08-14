/**
 * React Query wiring: one place for query keys, cache policy, and the hooks
 * components consume. Keeping keys here means an invalidation is never a
 * stringly-typed guess at a call site.
 */
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, isUnauthorized } from "./api";
import type { AuthUser } from "./api";

export const queryKeys = {
  session: ["auth", "me"] as const,
  portfolio: ["portfolio"] as const,
  portfolioHistory: ["portfolio", "history"] as const,
  watchlist: ["watchlist"] as const,
  latestAgentOutput: (symbol: string) => ["agents", "latest", symbol] as const,
  experimentsSuite: (symbol: string) => ["experiments", "suite", symbol] as const,
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
    // Clear the cache on the way out either way: if the server already
    // dropped the session, the client must not keep rendering stale
    // portfolio data behind a dead cookie.
    onSettled: () => {
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

/**
 * Non-critical: the history route is additive (see CONTRACT GAPS in api.ts).
 * Its failure degrades the chart to an empty state and leaves the rest of the
 * dashboard alone, so it never retries.
 */
export function usePortfolioHistory() {
  return useQuery({
    queryKey: queryKeys.portfolioHistory,
    queryFn: ({ signal }) => api.portfolioHistory(signal),
    retry: false,
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: ({ signal }) => api.watchlist(signal),
    staleTime: 5 * 60_000,
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
