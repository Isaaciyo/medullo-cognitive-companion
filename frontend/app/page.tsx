"use client";

import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AuthTokenPrompt } from "@/components/AuthTokenPrompt";
import { EmptyState } from "@/components/EmptyState";
import { WelcomeCard } from "@/components/WelcomeCard";
import {
  captureAccessTokenFromUrl,
  clearStoredAccessToken,
  getApiBaseUrl,
  getLastInterruptedSession,
  getSnapshot,
  getStoredAccessToken,
} from "@/lib/api";
import type { SessionDetail, Snapshot } from "@/lib/types";

export default function HomePage() {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
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
      const nextSession = await getLastInterruptedSession();
      const nextSnapshot = nextSession ? await getSnapshot(nextSession.id) : null;
      setSession(nextSession);
      setSnapshot(nextSnapshot);
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
    <main className="relative min-h-screen w-full fade-in-canvas">
      <AmbientBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="absolute right-6 top-6 z-20 flex gap-3">
          <a
            href="/interruptions"
            className="rounded-full border border-white/80 bg-white/80 px-4 py-3 text-sm text-ink-700 shadow-lg shadow-mist-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
          >
            <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-ink-400">Cognitive</span>
            <span className="block text-[0.95rem] font-medium">Interruptions</span>
          </a>
          <a
            href="/sessions"
            className="rounded-full border border-white/80 bg-white/80 px-4 py-3 text-sm text-ink-700 shadow-lg shadow-mist-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
          >
            <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-ink-400">Archive</span>
            <span className="block text-[0.95rem] font-medium">All sessions</span>
          </a>
        </div>
        {needsToken ? (
          <AuthTokenPrompt onTokenSaved={load} />
        ) : loading ? (
          <EmptyState />
        ) : error ? (
          <BackendOffline message={error} />
        ) : session && snapshot ? (
          <WelcomeCard session={session} snapshot={snapshot} />
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

function BackendOffline({ message }: { message: string }) {
  return (
    <section className="mx-auto max-w-md px-6 text-center">
      <h1 className="font-welcome text-5xl text-ink-900">Soon.</h1>
      <p className="mt-6 text-base font-light leading-relaxed text-ink-700">
        Medullo can&rsquo;t reach your recent memory right now.
      </p>
      <p className="mt-2 text-sm font-light text-ink-500">{message}</p>
      <p className="mt-6 text-xs text-ink-400">
        Configured API:{" "}
        <code className="rounded bg-mist-100 px-1.5 py-0.5">{getApiBaseUrl()}</code>
      </p>
      <a
        href="/connect"
        className="mt-6 inline-flex rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm text-ink-700 shadow-lg shadow-mist-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
      >
        Connect account
      </a>
    </section>
  );
}
