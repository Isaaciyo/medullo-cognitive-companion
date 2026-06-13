"use client";

import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AuthTokenPrompt } from "@/components/AuthTokenPrompt";
import {
  captureAccessTokenFromUrl,
  clearStoredAccessToken,
  getStoredAccessToken,
  listSessions,
} from "@/lib/api";
import type { Session } from "@/lib/types";

export default function InterruptionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    captureAccessTokenFromUrl();
    if (!getStoredAccessToken()) {
      setNeedsToken(true);
      setLoading(false);
      return;
    }
    setNeedsToken(false);
    try {
      const nextSessions = await listSessions({ interrupted: true, limit: 10 });
      setSessions(nextSessions.filter((s) => s.snapshot_generated_at !== null));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not reach Medullo.";
      if (message.includes("access token")) {
        clearStoredAccessToken();
        setNeedsToken(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden fade-in-canvas">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-8 lg:px-10">
        <header className="mb-8 border-b border-white/60 pb-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-400">Cognitive Continuity</p>
              <h1 className="mt-3 font-welcome text-[clamp(2.5rem,7vw,4rem)] leading-tight">
                Your interrupted moments.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-ink-700 sm:text-base">
                When focus breaks, Medullo remembers what you were thinking. Here are the snapshots waiting to restore your momentum.
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm text-ink-700 shadow-lg shadow-mist-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Back
            </a>
          </div>
        </header>

        {needsToken ? (
          <AuthTokenPrompt onTokenSaved={load} />
        ) : loading ? (
          <section className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-xl shadow-mist-200/70 backdrop-blur">
            <h2 className="font-welcome text-4xl text-ink-900">Loading.</h2>
          </section>
        ) : error ? (
          <section className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-xl shadow-mist-200/70 backdrop-blur">
            <h2 className="font-welcome text-4xl text-ink-900">Soon.</h2>
            <p className="mt-4 text-sm text-ink-700">The interruptions archive needs the backend to be running.</p>
            <p className="mt-2 text-xs text-ink-500">{error}</p>
          </section>
        ) : sessions.length === 0 ? (
          <section className="rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-xl shadow-mist-200/70 backdrop-blur">
            <h2 className="font-welcome text-4xl text-ink-900">No interruptions yet.</h2>
            <p className="mt-4 text-sm text-ink-700">
              When your focus breaks unexpectedly, Medullo will capture a snapshot here so you can pick up exactly where you left off.
            </p>
          </section>
        ) : (
          <section className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-8">
            {sessions.map((session) => (
              <InterruptionCard key={session.id} session={session} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function InterruptionCard({ session }: { session: Session }) {
  const hasSnapshot = session.snapshot_generated_at !== null;

  return (
    <article className="rounded-[28px] border border-white/80 bg-white/85 p-7 shadow-xl shadow-mist-200/70 backdrop-blur transition duration-300 hover:border-white hover:bg-white hover:shadow-2xl hover:shadow-mist-200/80">
      {/* Header: Task + Metadata */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.24em] text-ink-400">Session #{session.id}</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-amber-700">
              {session.interruption_type ?? "interrupted"}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-ink-900 md:text-3xl">
            {session.title || "Interrupted work session"}
          </h2>
          <p className="mt-2 text-sm text-ink-600">{session.primary_domain || "Unlabelled context"}</p>
        </div>
        <div className="text-right text-sm text-ink-500">
          <div className="font-mono text-xs text-ink-400">{formatTime(session.ended_at ?? session.started_at)}</div>
          <div className="mt-1">{Math.max(1, Math.round(session.total_active_seconds / 60))} min</div>
        </div>
      </div>

      {/* Snapshot Content (if available) */}
      {hasSnapshot && (
        <div className="mt-6 space-y-5 border-t border-mist-200/70 pt-6">
          {/* Task */}
          {session.title && (
            <div>
              <h3 className="text-xs uppercase tracking-[0.22em] text-ink-400">What you were doing</h3>
              <p className="mt-2 text-base text-ink-800">{session.title}</p>
            </div>
          )}

          {/* Progress & Blockers Grid */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Progress */}
            <div>
              <h3 className="text-xs uppercase tracking-[0.22em] text-ink-400">Progress made</h3>
              {session.keywords && session.keywords.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {session.keywords.slice(0, 3).map((keyword) => (
                    <li key={keyword} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-sm text-ink-700">{keyword}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm italic text-ink-500">Work in progress…</p>
              )}
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-xs uppercase tracking-[0.22em] text-ink-400">Session metrics</h3>
              <dl className="mt-3 space-y-2 text-sm text-ink-700">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-500">Signals received</dt>
                  <dd className="font-mono">{session.event_count}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-ink-500">Active time</dt>
                  <dd className="font-mono">{Math.max(1, Math.round(session.total_active_seconds / 60))} min</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* Footer: Metadata */}
      <div className="mt-6 border-t border-mist-200/70 pt-4 text-xs text-ink-500">
        {hasSnapshot ? (
          <span>✓ Snapshot captured at {formatTime(session.snapshot_generated_at)}</span>
        ) : (
          <span className="italic">Snapshot pending…</span>
        )}
      </div>
    </article>
  );
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
