/**
 * Test harness: a contract-exact `fetch` double plus a render helper that wires
 * the same providers `main.tsx` does.
 *
 * The double answers by PATH (the `/api` prefix Vite proxies is stripped first),
 * so the tests exercise the real `src/lib/api.ts` client — including its
 * `credentials: "include"`, its status handling, and its contract parsing.
 * Nothing is stubbed above the network boundary, which is what makes swapping
 * in the live backend a no-op.
 */
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { ReactNode } from "react";
import { AppRoutes } from "../src/App";
import { createQueryClient } from "../src/lib/queries";
import { ThemeProvider } from "../src/theme/ThemeProvider";

export interface MockReply {
  status?: number;
  /** JSON body. `undefined` sends an empty body (like a 204). */
  body?: unknown;
}

export type MockHandler = MockReply | ((init: RequestInit) => MockReply);

/** Keys are API paths without the `/api` prefix, e.g. `GET /portfolio`. */
export type MockRoutes = Record<string, MockHandler>;

export interface MockApi {
  /** Every path the app requested, in order. */
  calls: string[];
  /** Swap a route mid-test (e.g. `/auth/me` starts 401, becomes 200). */
  set: (path: string, handler: MockHandler) => void;
}

export function mockApi(routes: MockRoutes): MockApi {
  const table: MockRoutes = { ...routes };
  const calls: string[] = [];

  const fetchDouble = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const path = url.startsWith("/api") ? url.slice("/api".length) : url;
    calls.push(path);

    const handler = table[path] ?? table[path.split("?")[0] ?? path];
    const reply: MockReply = handler
      ? typeof handler === "function"
        ? handler(init ?? {})
        : handler
      : { status: 404, body: { message: `No mock for ${path}` } };

    const status = reply.status ?? 200;
    const text = reply.body === undefined ? "" : JSON.stringify(reply.body);

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    };
  });

  vi.stubGlobal("fetch", fetchDouble);

  return {
    calls,
    set: (path, handler) => {
      table[path] = handler;
    },
  };
}

/** Renders the real route table at `route`, with the real providers. */
export function renderApp(route = "/"): RenderResult {
  const queryClient = createQueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

/** Renders a bare component inside the providers (no router entry needed). */
export function renderWithProviders(ui: ReactNode): RenderResult {
  const queryClient = createQueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

/** The happy path every test starts from, then narrows. */
export function signedInRoutes(overrides: MockRoutes = {}): MockRoutes {
  return {
    "/auth/me": { status: 200, body: { user: { id: "usr_01HZX", email: "analyst@committee.test" } } },
    ...overrides,
  };
}
