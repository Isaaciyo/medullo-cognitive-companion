import type { Session, SessionDetail, Snapshot } from "./types";

// Two URLs, because docker-compose networking is different from the browser:
//   - On the server (SSR inside the frontend container), `localhost` means
//     the frontend container itself, not the host. We need the in-network
//     hostname `http://backend:8000` (Docker resolves this to the backend
//     service). `INTERNAL_API_URL` is set as a runtime env by docker-compose.
//   - In the browser, the user is on the host machine and `localhost:8000`
//     points at the published backend port. `NEXT_PUBLIC_API_URL` is baked
//     into the bundle at build time.
// For Vercel + a public Railway backend, INTERNAL_API_URL is unset and we
// fall through to NEXT_PUBLIC_API_URL on both server and client, which is
// the same Railway URL — that's also correct.
const SERVER_API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";
const BROWSER_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ACCESS_TOKEN_KEY = "medullo:accessToken";

function apiUrl(): string {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;
}

export function getApiBaseUrl(): string {
  return apiUrl();
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return process.env.MEDULLO_ACCESS_TOKEN ?? null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token.trim());
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function captureAccessTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  let token = params.get("token");
  if (!token && window.location.hash) {
    const hash = window.location.hash.replace(/^#/, "");
    token = new URLSearchParams(hash).get("token");
  }
  if (!token) return null;
  setStoredAccessToken(token);
  window.history.replaceState(null, "", window.location.pathname);
  return token;
}

async function get<T>(path: string): Promise<T | null> {
  const token = getStoredAccessToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${apiUrl()}${path}`, { cache: "no-store", headers });
  if (res.status === 401) throw new Error("Medullo needs your access token.");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  // 200 with literal `null` body (FastAPI returns "null") becomes null here:
  const text = await res.text();
  if (!text || text === "null") return null;
  return JSON.parse(text) as T;
}

export async function getLastInterruptedSession(): Promise<SessionDetail | null> {
  return get<SessionDetail>("/sessions/last-interrupted");
}

export async function getSnapshot(sessionId: number): Promise<Snapshot | null> {
  return get<Snapshot>(`/sessions/${sessionId}/snapshot`);
}

export async function listSessions(opts: { interrupted?: boolean; limit?: number } = {}): Promise<Session[]> {
  const params = new URLSearchParams();
  if (opts.interrupted !== undefined) params.set("interrupted", String(opts.interrupted));
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await get<Session[]>(`/sessions${qs ? `?${qs}` : ""}`);
  return data ?? [];
}
