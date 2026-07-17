import { useAuthStore } from "../store/authStore";

const API_BASE = "http://localhost:4000/api";

class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any) {
    super(data?.error || "API Error");
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Fetch wrapper that automatically attaches the access token and
 * handles 401s by transparently refreshing the token and retrying the request.
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const { accessToken } = useAuthStore.getState();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include", // For refresh cookie
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!refreshResponse.ok) {
          useAuthStore.getState().clearAuth();
          throw new Error("Session expired");
        }

        const data = await refreshResponse.json();
        useAuthStore.getState().setAccessToken(data.accessToken);

        isRefreshing = false;
        onRefreshed(data.accessToken);
      } catch (error) {
        isRefreshing = false;
        useAuthStore.getState().clearAuth();
        throw error;
      }
    }

    // Wait for the refresh to finish and retry with the new token
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        headers.set("Authorization", `Bearer ${newToken}`);
        resolve(fetch(`${API_BASE}${endpoint}`, { ...config, headers }).then((res) => res.json()));
      });
    });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}
