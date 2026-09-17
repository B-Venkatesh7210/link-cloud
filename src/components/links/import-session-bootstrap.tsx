"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppState } from "@/components/app-shell/app-state";
import {
  IMPORT_STORAGE_KEY,
  parseLinksFile,
} from "@/lib/import/parse-links-file";

/** Picks up a file import started from Settings and opens the review queue. */
export function ImportSessionBootstrap() {
  const { links, openImportQueue } = useAppState();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    try {
      const raw = sessionStorage.getItem(IMPORT_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(IMPORT_STORAGE_KEY);

      const parsed = JSON.parse(raw) as {
        text?: string;
        filename?: string;
        at?: number;
      };

      if (!parsed.text) return;
      // Ignore stale payloads older than 10 minutes.
      if (parsed.at && Date.now() - parsed.at > 10 * 60 * 1000) return;

      const result = parseLinksFile(parsed.text, {
        filename: parsed.filename ?? "import.txt",
        existingLinks: links,
      });

      if (result.drafts.length === 0) {
        const bits = [];
        if (result.duplicateCount > 0) {
          bits.push(`${result.duplicateCount} already saved`);
        }
        if (result.invalidCount > 0) {
          bits.push(`${result.invalidCount} invalid`);
        }
        toast.error(
          bits.length > 0
            ? `Nothing new to import (${bits.join(", ")}).`
            : "No URLs found in that file."
        );
        return;
      }

      const extras = [];
      if (result.duplicateCount > 0) {
        extras.push(`${result.duplicateCount} skipped`);
      }
      if (result.invalidCount > 0) {
        extras.push(`${result.invalidCount} invalid`);
      }
      if (result.truncated) extras.push("truncated to 100");
      if (extras.length > 0) {
        toast.message(`${result.drafts.length} ready · ${extras.join(" · ")}`);
      } else {
        toast.message(`${result.drafts.length} links ready to review`);
      }

      openImportQueue(result.drafts);
    } catch {
      sessionStorage.removeItem(IMPORT_STORAGE_KEY);
    }
  }, [links, openImportQueue]);

  return null;
}
