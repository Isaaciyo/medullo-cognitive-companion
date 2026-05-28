"use client";

import { motion } from "framer-motion";

export function EmptyState() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.6, ease: "easeOut" }}
      className="mx-auto flex max-w-xl flex-col items-center px-6 py-24 text-center"
    >
      <motion.h1
        className="font-welcome text-[clamp(3.2rem,8vw,5rem)] leading-[1.02] text-ink-900"
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
      >
        Hello.
      </motion.h1>

      <motion.div
        className="mt-8 flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-[0.68rem] uppercase tracking-[0.18em] text-ink-400 shadow-sm shadow-mist-200/70 backdrop-blur"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.8 }}
      >
        Quiet memory · ready when you are
      </motion.div>

      <motion.p
        className="mt-6 text-lg font-light leading-relaxed text-ink-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 1.0 }}
      >
        Nothing to pick up just yet.
      </motion.p>

      <motion.p
        className="mt-3 max-w-md text-sm font-light leading-relaxed text-ink-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 1.4 }}
      >
        Open a few tabs, follow your curiosity. When you step away, Medullo will
        quietly remember where you were, so the next return feels easy.
      </motion.p>

      <motion.div
        className="mt-12 h-px w-16 bg-mist-200"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, delay: 2.0 }}
      />
    </motion.section>
  );
}
