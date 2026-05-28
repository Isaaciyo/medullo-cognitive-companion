"use client";

import { motion } from "framer-motion";
import type { SessionDetail, Snapshot } from "@/lib/types";

interface Props {
  session: SessionDetail;
  snapshot: Snapshot;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

const containerStagger = {
  visible: { transition: { staggerChildren: 0.18, delayChildren: 1.3 } },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "a moment ago";
  if (min === 1) return "1 minute ago";
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.round(min / 60);
  if (hr === 1) return "1 hour ago";
  if (hr < 24) return `${hr} hours ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "yesterday" : `${day} days ago`;
}

function interruptionDescription(t: string | null): string {
  switch (t) {
    case "idle":
      return "You stepped away";
    case "drift":
      return "Your focus drifted";
    case "gap":
      return "There was a quiet pause";
    default:
      return "You were here";
  }
}

export function WelcomeCard({ session, snapshot }: Props) {
  const interrupted = interruptionDescription(session.interruption_type);
  const when = timeAgo(session.ended_at);

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-24"
    >
      {/* Welcome — cursive, slow fade in, gentle scale-from-quiet */}
      <motion.h1
        className="font-welcome text-[clamp(3.8rem,10vw,6rem)] leading-[1.02] text-ink-900"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
      >
        Welcome back.
      </motion.h1>

      <motion.p
        className="mt-4 text-sm tracking-[0.18em] text-ink-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.9 }}
      >
        {interrupted} {when && `· ${when}`}
      </motion.p>

      {/* Snapshot body — staggers in after the welcome lands */}
      <motion.div
        variants={containerStagger}
        className="mt-12 w-full rounded-[32px] border border-white/80 bg-white/75 p-6 shadow-xl shadow-mist-200/70 backdrop-blur sm:p-8"
      >
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-ink-400">
          <span className="rounded-full bg-mist-100 px-3 py-1">Resume view</span>
          <span className="rounded-full bg-mist-100 px-3 py-1">{session.primary_domain ?? "your trail"}</span>
          {snapshot.model && <span className="rounded-full bg-mist-100 px-3 py-1">via {snapshot.model}</span>}
        </div>
        <div className="max-h-96 space-y-10 overflow-y-auto text-left pr-2">
        {snapshot.task && (
          <motion.div variants={fadeUp} transition={{ duration: 0.9, ease: "easeOut" }}>
            <p className="text-xs uppercase tracking-[0.16em] text-ink-400">
              You were
            </p>
            <p className="mt-2 text-2xl font-light leading-snug text-ink-900 sm:text-3xl">
              {snapshot.task}
            </p>
            {snapshot.intent && (
              <p className="mt-3 text-base font-light leading-relaxed text-ink-500">
                {snapshot.intent}
              </p>
            )}
          </motion.div>
        )}

        {snapshot.progress && snapshot.progress.length > 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.9, ease: "easeOut" }}>
            <SectionLabel>What you did</SectionLabel>
            <SoftList items={snapshot.progress} tone="ink-700" />
          </motion.div>
        )}

        {snapshot.blockers && snapshot.blockers.length > 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.9, ease: "easeOut" }}>
            <SectionLabel>Where you got stuck</SectionLabel>
            <SoftList items={snapshot.blockers} tone="ink-700" />
          </motion.div>
        )}

        {snapshot.next_steps && snapshot.next_steps.length > 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.9, ease: "easeOut" }}>
            <SectionLabel>A possible next step</SectionLabel>
            <SoftList items={snapshot.next_steps} tone="ink-900" emphasize />
          </motion.div>
        )}

        {/* Quiet footer: model, keywords, breadcrumbs to deeper context */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="border-t border-mist-200 pt-6 text-xs text-ink-400"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <span>
              {session.event_count} signals · {Math.round(session.total_active_seconds / 60)} min
              of attention · {session.primary_domain ?? "across the web"}
            </span>
            <div className="flex items-center gap-2">
              {snapshot.model && <span className="opacity-70">via {snapshot.model}</span>}
              <span className="text-ink-300">·</span>
              <a
                href="/interruptions"
                className="text-ink-500 transition hover:text-ink-700"
              >
                See more moments →
              </a>
            </div>
          </div>
        </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.16em] text-ink-400">{children}</p>
  );
}

function SoftList({
  items,
  tone,
  emphasize = false,
}: {
  items: string[];
  tone: "ink-700" | "ink-900";
  emphasize?: boolean;
}) {
  const toneClass = tone === "ink-900" ? "text-ink-900" : "text-ink-700";
  const weightClass = emphasize ? "font-normal" : "font-light";
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className={`flex gap-3 text-base leading-relaxed ${toneClass} ${weightClass}`}
        >
          <span className="mt-2 inline-block h-1 w-1 flex-none rounded-full bg-mist-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
