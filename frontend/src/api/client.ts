import type { ApiError, TokenPair } from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const ACCESS_KEY = "kle.access";
const REFRESH_KEY = "kle.refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(pair: Pick<TokenPair, "access_token" | "refresh_token">) {
    localStorage.setItem(ACCESS_KEY, pair.access_token);
    localStorage.setItem(REFRESH_KEY, pair.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class RequestError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, body: ApiError | undefined, fallback: string) {
    super(body?.error?.message ?? fallback);
    this.status = status;
    this.code = body?.error?.code ?? "error";
    this.details = body?.error?.details;
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh_token = tokenStore.refresh;
  if (!refresh_token) return false;
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const pair = (await r.json()) as TokenPair;
        tokenStore.set(pair);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && tokenStore.access)
      headers["Authorization"] = `Bearer ${tokenStore.access}`;
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  };

  let res = await doFetch();
  if (res.status === 401 && auth && tokenStore.refresh) {
    if (await tryRefresh()) {
      res = await doFetch();
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    throw new RequestError(res.status, json as ApiError, res.statusText);
  }
  return json as T;
}
