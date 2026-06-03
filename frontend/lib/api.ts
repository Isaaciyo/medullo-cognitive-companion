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

function apiUrl(): string {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${apiUrl()}${path}`, { cache: "no-store" });
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
