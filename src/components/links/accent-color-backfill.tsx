"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "@/components/app-shell/app-state";
import { needsLinkVisualEnrichment } from "@/lib/cloud/accent-color";
import { enrichLinkAccentAction } from "@/lib/links/actions";

const CONCURRENCY = 2;
const GAP_MS = 450;

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

  useEffect(() => {
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
          const batch = queueRef.current.splice(0, CONCURRENCY);
          await Promise.all(
            batch.map(async (id) => {
              inFlightRef.current.add(id);
              try {
                const result = await enrichLinkAccentAction(id);
                if (!result.success) {
                  failedRef.current.add(id);
                  return;
                }
                setLinks((prev) =>
                  prev.map((link) =>
                    link.id === id
                      ? {
                          ...link,
                          accent_color: result.data.accent_color,
                          favicon_url: result.data.favicon_url,
                        }
                      : link
                  )
                );
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
  }, [links, setLinks]);

  return null;
}
