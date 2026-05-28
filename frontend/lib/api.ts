import type { Session, SessionDetail, Snapshot } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
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
