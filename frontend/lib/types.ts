// Types mirroring the FastAPI backend schemas. Keep these in sync with
// backend/app/schemas.py when fields change.

export type EventType =
  | "tab_switch"
  | "page_focus"
  | "page_loaded"
  | "idle"
  | "active"
  | "search_query"
  | "interruption_detected";

export type InterruptionType = "idle" | "drift" | "gap" | "context_switch" | null;

export interface SessionEvent {
  id: number;
  timestamp: string;
  received_at: string;
  event_type: EventType;
  app: string;
  title: string | null;
  url: string | null;
  domain: string | null;
  duration_seconds: number | null;
  browsing_session_id: string | null;
  session_id: number | null;
}

export interface Session {
  id: number;
  started_at: string;
  ended_at: string | null;
  status: "active" | "closed";
  title: string | null;
  primary_domain: string | null;
  event_count: number;
  total_active_seconds: number;
  keywords: string[] | null;
  interruption_type: InterruptionType;
  snapshot_generated_at: string | null;
}

export interface SessionDetail extends Session {
  events: SessionEvent[];
}

export interface Snapshot {
  session_id: number;
  task: string | null;
  intent: string | null;
  progress: string[] | null;
  blockers: string[] | null;
  next_steps: string[] | null;
  generated_at: string | null;
  model: string | null;
}
