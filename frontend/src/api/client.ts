export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`/api${path}`, { ...init, headers });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(body.message ?? "Request failed");
  }
  return body.data;
}
