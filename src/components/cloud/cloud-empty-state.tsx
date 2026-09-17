"use client";

import { motion, useReducedMotion } from "motion/react";

function isMac() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/** Soft guidance shown above the centered Import / Add controls when the sky is empty. */
export function CloudEmptyState() {
  const reduceMotion = useReducedMotion();
  const pasteHint = isMac() ? "⌘V" : "Ctrl+V";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-1 flex max-w-sm flex-col items-center text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/25 blur-3xl"
      />

      <p className="max-w-[16rem] text-pretty text-[15px] leading-relaxed text-slate-400/75">
        Paste a URL anywhere, or start with the buttons below.
      </p>

      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/40 px-3.5 py-2 text-sm text-slate-500/85 shadow-sm ring-1 ring-white/55 backdrop-blur-md">
        <kbd className="rounded-lg bg-slate-900/[0.04] px-2 py-0.5 font-medium tracking-wide text-slate-600/85">
          {pasteHint}
        </kbd>
        <span className="text-slate-400/85">to drop a link into your sky</span>
      </div>
    </motion.div>
  );
}
