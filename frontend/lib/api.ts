export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Tokens = { access_token: string; refresh_token: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setTokens(t: Tokens | null) {
  accessToken = t?.access_token ?? null;
  refreshToken = t?.refresh_token ?? null;
  if (typeof window !== "undefined") {
    if (t) window.localStorage.setItem("clientos_tokens", JSON.stringify(t));
    else window.localStorage.removeItem("clientos_tokens");
  }
}

export function loadTokens() {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("clientos_tokens");
  if (raw) {
    try {
      const t = JSON.parse(raw);
      accessToken = t.access_token;
      refreshToken = t.refresh_token;
    } catch {
      window.localStorage.removeItem("clientos_tokens");
    }
  }
}

export function hasTokens() {
  return Boolean(accessToken);
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function refreshTokens(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { data: Tokens };
  const data = body.data;
  if (!data?.access_token) return false;
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("clientos_tokens", JSON.stringify(data));
  }
  return true;
}

type Req = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export async function api<T>(path: string, req: Req = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const doFetch = (tok: string | null) =>
    fetch(url.toString(), {
      method: req.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
    });

  let res = await doFetch(accessToken);
  if (res.status === 401 && accessToken) {
    const ok = await refreshTokens();
    if (ok) res = await doFetch(accessToken);
  }
  if (res.status === 401) {
    setTokens(null);
    onUnauthorized?.();
    throw new ApiError(401, "unauthorized", "Session expired");
  }
  if (!res.ok) {
    let code = "error";
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { code: string; message: string } };
      code = data.error?.code ?? code;
      message = data.error?.message ?? message;
    } catch {
      /* keep defaults */
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: T };
  return (body.data ?? body) as T;
}
