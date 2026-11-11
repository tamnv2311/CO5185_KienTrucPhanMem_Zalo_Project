import { adoptSharedTokens, readSession, updateTokens } from "./session";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }

  /** True when the backend could not be reached or does not implement the endpoint yet. */
  get unavailable(): boolean {
    return this.status === 0 || this.status === 404 || this.status === 405 || this.status === 501 || this.status >= 502;
  }
}

const BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "/api";
const TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 120000;

export function accessToken(): string | null {
  return readSession()?.accessToken ?? null;
}

let refreshing: Promise<boolean> | undefined;

/** Exchanges the refresh token for a new pair. Concurrent callers share one request. */
function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    if (adoptSharedTokens()) return true;
    const refreshToken = readSession()?.refreshToken;
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()).data as { accessToken: string; refreshToken: string };
      updateTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  const upload = init.body instanceof FormData;
  if (!upload) headers.set("Content-Type", "application/json");
  const token = accessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), upload ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new ApiError("Không kết nối được máy chủ", 0);
  } finally {
    clearTimeout(timer);
  }

  // An expired access token is renewed once, transparently.
  if (response.status === 401 && token && !retried && !path.startsWith("/auth/")) {
    if (await refreshTokens()) return api<T>(path, init, true);
    window.dispatchEvent(new Event("zalolite:unauthorized"));
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // A HTML page (e.g. Vite dev server fallback) means the API is not there.
      throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ", response.ok ? 502 : response.status);
    }
  }
  if (!response.ok) {
    const message = (body as { message?: string } | undefined)?.message ?? `Yêu cầu thất bại (${response.status})`;
    throw new ApiError(message, response.status);
  }
  // Accept both the { success, data } envelope and raw JSON payloads.
  if (body && typeof body === "object" && "data" in (body as object) && "success" in (body as object)) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}
