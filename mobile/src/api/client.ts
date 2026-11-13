import { DEFAULT_SERVER } from "../config";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const TIMEOUT_MS = 12000;
const UPLOAD_TIMEOUT_MS = 120000;

let server = DEFAULT_SERVER;
let tokens: Tokens | undefined;
let onTokens: (tokens: Tokens) => void = () => undefined;
let onUnauthorized: () => void = () => undefined;

export const getServer = () => server;
export const setServer = (url: string) => { server = url; };
export const setTokens = (next: Tokens | undefined) => { tokens = next; };
export const accessToken = () => tokens?.accessToken;
export const refreshToken = () => tokens?.refreshToken;

/** The store persists renewed tokens and signs out when they can no longer be renewed. */
export function onSessionChange(handlers: { tokens: (tokens: Tokens) => void; unauthorized: () => void }) {
  onTokens = handlers.tokens;
  onUnauthorized = handlers.unauthorized;
}

/** Server files are stored as "/api/media/..." paths; the app needs absolute URLs. */
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${server}${url}` : url;
}

export function socketUrl(): string {
  // /ws is the SockJS endpoint; /ws/websocket is its plain WebSocket transport.
  return `${server.replace(/^http/i, "ws")}/ws/websocket`;
}

let refreshing: Promise<boolean> | undefined;

/** Exchanges the refresh token for a new pair. Concurrent callers share one request. */
export function renewTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const current = tokens?.refreshToken;
    if (!current) return false;
    try {
      const response = await fetch(`${server}/api/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: current }),
      });
      if (!response.ok) return false;
      const data = (await response.json()).data as Tokens;
      tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
      onTokens(tokens);
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  const upload = init.body instanceof FormData;
  // For uploads the runtime must set the multipart boundary itself.
  if (!upload) headers["Content-Type"] = "application/json";
  const token = tokens?.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), upload ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${server}/api${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new ApiError("Không kết nối được máy chủ", 0);
  } finally {
    clearTimeout(timer);
  }

  // An expired access token is renewed once, transparently.
  if (response.status === 401 && token && !retried && !path.startsWith("/auth/")) {
    if (await renewTokens()) return api<T>(path, init, true);
    onUnauthorized();
  }

  const text = await response.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ", response.ok ? 502 : response.status);
    }
  }
  if (!response.ok) {
    const message = (body as { message?: string } | undefined)?.message ?? `Yêu cầu thất bại (${response.status})`;
    throw new ApiError(message, response.status);
  }
  // The backend wraps payloads in { success, data, message }.
  if (body && typeof body === "object" && "data" in body && "success" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại";
}
