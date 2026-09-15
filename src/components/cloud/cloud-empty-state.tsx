"use client";

import { motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useAppState } from "@/components/app-shell/app-state";
import { Button } from "@/components/ui/button";

function isMac() {
  if (typeof navigator === "undefined") return true;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function GhostBubble({
  className,
  label,
  host,
}: {
  className: string;
  label: string;
  host: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-[1.5rem] border border-white/50 bg-white/35 px-3 py-2.5 shadow-sm backdrop-blur-[1px] ${className}`}
    >
      <div className="flex items-center gap-2 opacity-50">
        <span className="size-7 rounded-lg bg-sky-100/80" />
        <div>
          <p className="text-xs font-medium text-slate-600">{label}</p>
          <p className="text-[10px] text-slate-400">{host}</p>
        </div>
      </div>
    </div>
  );
}

export function CloudEmptyState() {
  const { openAddLink } = useAppState();
  const reduceMotion = useReducedMotion();
  const pasteHint = isMac() ? "⌘ V" : "Ctrl V";

  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <GhostBubble
        className="left-[12%] top-[22%] hidden w-40 rotate-[-6deg] sm:block"
        label="Analytics"
        host="dashboards…"
      />
      <GhostBubble
        className="right-[14%] top-[28%] hidden w-44 rotate-[5deg] md:block"
        label="Design file"
        host="figma.com"
      />
      <GhostBubble
        className="bottom-[24%] left-[18%] hidden w-36 rotate-[3deg] lg:block"
        label="Staging"
        host="app-staging…"
      />
      <GhostBubble
        className="right-[18%] bottom-[26%] hidden w-40 rotate-[-4deg] sm:block"
        label="Customer portal"
        host="portal…"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-md text-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/35 blur-3xl"
        />

        <p className="text-balance text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
          Your internet memory starts here.
        </p>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-slate-500">
          Paste any URL anywhere on this screen.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/55 px-4 py-2.5 text-sm text-slate-600 shadow-sm ring-1 ring-white/70 backdrop-blur-md">
            <kbd className="rounded-lg bg-slate-900/5 px-2.5 py-1 font-medium tracking-wide text-slate-700">
              {pasteHint}
            </kbd>
            <span className="text-slate-400">to save a link</span>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={() => openAddLink()}
            className="h-11 rounded-2xl bg-slate-900 px-5 text-white shadow-lg shadow-sky-900/10 hover:bg-slate-800"
          >
            <Plus className="size-4" />
            Paste your first link
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
