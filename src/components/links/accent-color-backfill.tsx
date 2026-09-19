"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "@/components/app-shell/app-state";
import { needsLinkVisualEnrichment } from "@/lib/cloud/accent-color";
import { enrichLinkAccentAction } from "@/lib/links/actions";

/** Keep canvas snappy under large imports — one at a time, with gaps. */
const CONCURRENCY = 1;
const GAP_MS = 900;
/** Coalesce local state patches so the cloud doesn't rebuild every response. */
const FLUSH_MS = 700;

type VisualPatch = {
  accent_color: string;
  favicon_url: string | null;
};

/**
 * Quietly fills accent_color + favicon_url for links on the canvas
 * (missing visuals after bulk import, black theme-colors, older rows).
 */
export function AccentColorBackfill() {
  const { links, setLinks } = useAppState();
  const inFlightRef = useRef(new Set<string>());
  const failedRef = useRef(new Set<string>());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  const pendingPatchesRef = useRef(new Map<string, VisualPatch>());
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function flushPatches() {
      flushTimerRef.current = null;
      const patches = pendingPatchesRef.current;
      if (patches.size === 0) return;
      pendingPatchesRef.current = new Map();
      setLinks((prev) =>
        prev.map((link) => {
          const patch = patches.get(link.id);
          return patch
            ? {
                ...link,
                accent_color: patch.accent_color,
                favicon_url: patch.favicon_url,
              }
            : link;
        })
      );
    }

    function schedulePatch(id: string, patch: VisualPatch) {
      pendingPatchesRef.current.set(id, patch);
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = window.setTimeout(flushPatches, FLUSH_MS);
    }

    const needing = links
      .filter(
        (link) =>
          needsLinkVisualEnrichment(link) &&
          !inFlightRef.current.has(link.id) &&
          !failedRef.current.has(link.id)
      )
      .map((link) => link.id);

    for (const id of needing) {
      if (!queueRef.current.includes(id)) {
        queueRef.current.push(id);
      }
    }

    async function pump() {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        while (queueRef.current.length > 0) {
          if (typeof document !== "undefined" && document.hidden) {
            await new Promise<void>((resolve) => {
              const onVisible = () => {
                document.removeEventListener("visibilitychange", onVisible);
                resolve();
              };
              document.addEventListener("visibilitychange", onVisible);
            });
          }

          const batch = queueRef.current.splice(0, CONCURRENCY);
          await Promise.all(
            batch.map(async (id) => {
              inFlightRef.current.add(id);
              try {
                const result = await enrichLinkAccentAction(id);
                if (!result.success) {
                  // Rate limits / transient errors — retry later, don't poison forever.
                  if (result.error?.includes("Too many")) {
                    await new Promise((resolve) =>
                      window.setTimeout(resolve, 8000)
                    );
                    if (!queueRef.current.includes(id)) {
                      queueRef.current.push(id);
                    }
                  } else {
                    failedRef.current.add(id);
                  }
                  return;
                }
                schedulePatch(id, {
                  accent_color: result.data.accent_color,
                  favicon_url: result.data.favicon_url,
                });
              } catch {
                failedRef.current.add(id);
              } finally {
                inFlightRef.current.delete(id);
              }
            })
          );
          if (queueRef.current.length > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, GAP_MS));
          }
        }
      } finally {
        runningRef.current = false;
        if (queueRef.current.length > 0) {
          void pump();
        }
      }
    }

    void pump();

    return () => {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [links, setLinks]);

  return null;
}
