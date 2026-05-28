import { AmbientBackground } from "@/components/AmbientBackground";
import { EmptyState } from "@/components/EmptyState";
import { WelcomeCard } from "@/components/WelcomeCard";
import { getLastInterruptedSession, getSnapshot } from "@/lib/api";

// Always fresh — the resume UI is a moment-of-return surface, never cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  let session = null;
  let snapshot = null;
  let error: string | null = null;

  try {
    session = await getLastInterruptedSession();
    if (session) {
      snapshot = await getSnapshot(session.id);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach Medullo.";
  }

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
        {error ? (
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
        Make sure the backend is running on{" "}
        <code className="rounded bg-mist-100 px-1.5 py-0.5">localhost:8000</code>.
      </p>
    </section>
  );
}
