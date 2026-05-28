import { AmbientBackground } from "@/components/AmbientBackground";
import { listSessions } from "@/lib/api";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SessionsPage() {
  let sessions: Session[] = [];
  let error: string | null = null;

  try {
    sessions = await listSessions({ interrupted: true, limit: 12 });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach Medullo.";
  }

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden fade-in-canvas">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/60 pb-6 text-ink-900 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink-400">Memory lane</p>
            <h1 className="mt-2 font-welcome text-[clamp(3rem,8vw,4.5rem)] leading-tight">Recent interruptions</h1>
            <p className="mt-3 max-w-2xl text-sm text-ink-700 sm:text-base">
              A quiet archive of the moments Medullo already recognized as worth returning to.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-ink-400 shadow-sm shadow-mist-200/70 backdrop-blur">Calm recall</span>
            <a
              href="/"
              className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm text-ink-700 shadow-lg shadow-mist-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
            >
              Back to welcome
            </a>
          </div>
        </header>

        {error ? (
          <section className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-xl shadow-mist-200/70 backdrop-blur">
            <h2 className="font-welcome text-4xl text-ink-900">Soon.</h2>
            <p className="mt-4 text-sm text-ink-700">The session archive needs the backend to be running.</p>
            <p className="mt-2 text-xs text-ink-500">{error}</p>
          </section>
        ) : sessions.length === 0 ? (
          <section className="rounded-3xl border border-white/70 bg-white/75 p-8 text-center shadow-xl shadow-mist-200/70 backdrop-blur">
            <h2 className="font-welcome text-4xl text-ink-900">No interruptions yet.</h2>
            <p className="mt-4 text-sm text-ink-700">Once your browser leaves a trail of interrupted focus, this archive will fill in naturally.</p>
          </section>
        ) : (
          <section className="grid min-h-0 max-h-[calc(100vh-10rem)] flex-1 gap-5 overflow-y-auto pb-8 md:grid-cols-2 xl:grid-cols-3">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="group rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-xl shadow-mist-200/70 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white hover:shadow-2xl hover:shadow-mist-200/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-ink-400">Session #{session.id}</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink-900">{getSessionTitle(session)}</h2>
                  </div>
                  <span className="rounded-full bg-mist-100 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-ink-500">
                    {session.interruption_type ?? "open"}
                  </span>
                </div>

                <p className="mt-4 text-sm text-ink-700">
                  {session.primary_domain ?? "A calm, unlabelled return to your own trail of thought"}
                </p>

                <dl className="mt-5 space-y-3 text-sm text-ink-700">
                  <div className="flex items-center justify-between gap-4 border-t border-mist-200/70 pt-3">
                    <dt className="text-ink-400">Signals</dt>
                    <dd>{session.event_count}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-400">Attention</dt>
                    <dd>{Math.max(1, Math.round(session.total_active_seconds / 60))} min</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-400">Ended</dt>
                    <dd>{formatTime(session.ended_at ?? session.started_at)}</dd>
                  </div>
                </dl>

                <footer className="mt-6 flex flex-col gap-3 border-t border-mist-200/70 pt-4 text-xs text-ink-400">
                  <div className="flex items-center justify-between gap-3">
                    <span className={session.snapshot_generated_at ? "text-ink-500" : "text-ink-400"}>
                      {session.snapshot_generated_at ? "Snapshot ready" : "Awaiting snapshot"}
                    </span>
                    <span>{Math.max(1, Math.round(session.total_active_seconds / 60))} min of attention</span>
                  </div>
                  {session.keywords && session.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {session.keywords.slice(0, 3).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-mist-50 px-2.5 py-1 text-[0.68rem] text-ink-500">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[0.68rem] uppercase tracking-[0.18em] text-ink-400">calm recall</span>
                  )}
                </footer>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function getSessionTitle(session: Session) {
  const candidate = session.title?.trim();

  if (candidate && candidate.toLowerCase() !== "a quiet focus span") {
    return candidate;
  }

  const domain = session.primary_domain?.replace(/^www\./, "").split(".")[0];
  if (domain && domain !== "newtab") {
    return `Returning to ${domain}`;
  }

  const keyword = session.keywords?.find((item) => item.trim().length > 0);
  if (keyword) {
    return `Returning to ${keyword}`;
  }

  return "Interrupted focus session";
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
