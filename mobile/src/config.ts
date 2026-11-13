/**
 * Address of the ZaloLite server (the reverse proxy in front of the web client and the gateway).
 * Override it with EXPO_PUBLIC_SERVER_URL in mobile/.env, or on the sign-in screen.
 */
export const DEFAULT_SERVER = (process.env.EXPO_PUBLIC_SERVER_URL ?? "https://minizeplao.eastasia.cloudapp.azure.com").replace(/\/+$/, "");

/** Accepts "host", "host:port" or a full URL; returns "scheme://host[:port]" without a trailing slash. */
export function normalizeServer(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SERVER;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}
