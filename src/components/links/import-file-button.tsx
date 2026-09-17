"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  IMPORT_STORAGE_KEY,
  parseLinksFile,
  readImportFile,
  type ImportDraft,
} from "@/lib/import/parse-links-file";
import { APP_ROUTES } from "@/config/app";
import type { LinkWithTags } from "@/lib/types";

function summarizeParse(result: {
  drafts: ImportDraft[];
  invalidCount: number;
  duplicateCount: number;
  truncated: boolean;
}) {
  if (result.drafts.length === 0) {
    const bits = [];
    if (result.duplicateCount > 0) bits.push(`${result.duplicateCount} already saved`);
    if (result.invalidCount > 0) bits.push(`${result.invalidCount} invalid`);
    toast.error(
      bits.length > 0
        ? `Nothing new to import (${bits.join(", ")}).`
        : "No URLs found in that file."
    );
    return false;
  }

  const extras = [];
  if (result.duplicateCount > 0) extras.push(`${result.duplicateCount} skipped (already saved)`);
  if (result.invalidCount > 0) extras.push(`${result.invalidCount} invalid`);
  if (result.truncated) extras.push("truncated to 100");
  if (extras.length > 0) {
    toast.message(`${result.drafts.length} ready · ${extras.join(" · ")}`);
  }
  return true;
}

/** File picker that opens the in-app import queue (requires AppState). */
export function ImportFileButton({
  links,
  onQueue,
  variant = "outline",
  className,
  label = "Import .txt / .csv",
}: {
  links: LinkWithTags[];
  onQueue: (drafts: ImportDraft[]) => void;
  variant?: "outline" | "ghost" | "default";
  className?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".csv")) {
      toast.error("Please choose a .txt or .csv file.");
      return;
    }

    try {
      const text = await readImportFile(file);
      const parsed = parseLinksFile(text, {
        filename: file.name,
        existingLinks: links,
      });
      if (!summarizeParse(parsed)) return;
      onQueue(parsed.drafts);
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] ?? null);
        }}
      />
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}

/**
 * Settings-page import: stash drafts and jump to /app so the review UI can open.
 */
export function SettingsImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".csv")) {
      toast.error("Please choose a .txt or .csv file.");
      return;
    }

    try {
      const text = await readImportFile(file);
      // Settings doesn't have live links in context for dedupe — parse without,
      // app will re-filter when opening if needed. Store raw text + filename.
      sessionStorage.setItem(
        IMPORT_STORAGE_KEY,
        JSON.stringify({ text, filename: file.name, at: Date.now() })
      );
      window.location.href = APP_ROUTES.app;
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0] ?? null);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-10 rounded-xl"
        onClick={() => inputRef.current?.click()}
      >
        Import .txt / .csv
      </Button>
    </>
  );
}
