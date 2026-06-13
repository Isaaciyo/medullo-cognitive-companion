"use client";

import { useEffect, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AuthTokenPrompt } from "@/components/AuthTokenPrompt";
import { captureAccessTokenFromUrl, getStoredAccessToken } from "@/lib/api";

export default function ConnectPage() {
  const [connected, setConnected] = useState(false);

  function refresh() {
    captureAccessTokenFromUrl();
    setConnected(Boolean(getStoredAccessToken()));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <main className="relative min-h-screen w-full fade-in-canvas">
      <AmbientBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        {connected ? (
          <section className="mx-auto max-w-md px-6 text-center">
            <h1 className="font-welcome text-5xl text-ink-900">Connected.</h1>
            <p className="mt-6 text-base font-light leading-relaxed text-ink-700">
              This browser is now scoped to your Medullo memory.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex rounded-full border border-white/80 bg-ink-900 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-mist-200/70 transition hover:-translate-y-0.5"
            >
              Open welcome view
            </a>
          </section>
        ) : (
          <AuthTokenPrompt onTokenSaved={refresh} />
        )}
      </div>
    </main>
  );
}
