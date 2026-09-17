import { normalizeUrl, findLinkByUrl } from "@/lib/normalize-url";

export const IMPORT_MAX_ROWS = 100;
export const IMPORT_STORAGE_KEY = "linkcloud:pending-import";

export type ImportDraft = {
  id: string;
  url: string;
  label: string;
  tags: string[];
};

export type ParseLinksFileResult = {
  drafts: ImportDraft[];
  invalidCount: number;
  duplicateCount: number;
  truncated: boolean;
};

function guessLabelFromUrl(url: string): string {
  try {
    return normalizeUrl(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 20)
    )
  );
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.map((c) => c.toLowerCase()).join("|");
  return (
    joined.includes("url") ||
    joined.includes("link") ||
    joined.includes("href") ||
    (joined.includes("label") && cells.length >= 2)
  );
}

function parseCsv(text: string): Array<{ url: string; label: string; tags: string[] }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstCells = splitCsvLine(lines[0]!);
  const hasHeader = looksLikeHeader(firstCells);
  const start = hasHeader ? 1 : 0;

  let urlIdx = 0;
  let labelIdx = 1;
  let tagsIdx = 2;

  if (hasHeader) {
    const headers = firstCells.map((h) => h.toLowerCase());
    urlIdx = Math.max(
      0,
      headers.findIndex((h) => h === "url" || h === "link" || h === "href")
    );
    const labelFound = headers.findIndex(
      (h) => h === "label" || h === "title" || h === "name"
    );
    labelIdx = labelFound >= 0 ? labelFound : urlIdx === 0 ? 1 : 0;
    const tagsFound = headers.findIndex(
      (h) => h === "tags" || h === "tag" || h === "labels"
    );
    tagsIdx = tagsFound >= 0 ? tagsFound : -1;
  }

  const rows: Array<{ url: string; label: string; tags: string[] }> = [];

  for (let i = start; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const url = (cells[urlIdx] ?? "").trim();
    if (!url) continue;
    const label = (cells[labelIdx] ?? "").trim();
    const tags = tagsIdx >= 0 ? parseTags(cells[tagsIdx]) : [];
    rows.push({ url, label, tags });
  }

  return rows;
}

function parseTxt(text: string): Array<{ url: string; label: string; tags: string[] }> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: Array<{ url: string; label: string; tags: string[] }> = [];

  for (const line of lines) {
    // url | label | tag1,tag2
    // url  label
    // url
    let url = "";
    let label = "";
    let tags: string[] = [];

    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      url = parts[0] ?? "";
      label = parts[1] ?? "";
      tags = parseTags(parts[2]);
    } else {
      const match = line.match(/^(\S+)(?:\s+(.+))?$/);
      if (!match) continue;
      url = match[1] ?? "";
      label = (match[2] ?? "").trim();
    }

    if (!url) continue;
    rows.push({ url, label, tags });
  }

  return rows;
}

function detectFormat(filename: string, text: string): "csv" | "txt" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "txt";

  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (firstLine.includes(",") && looksLikeHeader(splitCsvLine(firstLine))) {
    return "csv";
  }
  if ((firstLine.match(/,/g) ?? []).length >= 1 && firstLine.includes("http")) {
    return "csv";
  }
  return "txt";
}

/**
 * Parse a .txt / .csv import file into draft link rows.
 * Dedupes against existing links (www-tolerant) and within the file.
 */
export function parseLinksFile(
  text: string,
  options?: {
    filename?: string;
    existingLinks?: Array<{
      normalized_url: string;
      url: string;
      archived_at: string | null;
    }>;
    maxRows?: number;
  }
): ParseLinksFileResult {
  const filename = options?.filename ?? "import.txt";
  const maxRows = options?.maxRows ?? IMPORT_MAX_ROWS;
  const existing = options?.existingLinks ?? [];
  const format = detectFormat(filename, text);
  const rawRows = format === "csv" ? parseCsv(text) : parseTxt(text);

  const drafts: ImportDraft[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const seenNormalized = new Set<string>();
  let truncated = false;

  for (const row of rawRows) {
    if (drafts.length >= maxRows) {
      truncated = true;
      break;
    }

    let normalized;
    try {
      normalized = normalizeUrl(row.url);
    } catch {
      invalidCount += 1;
      continue;
    }

    if (seenNormalized.has(normalized.normalized)) {
      duplicateCount += 1;
      continue;
    }
    seenNormalized.add(normalized.normalized);

    if (findLinkByUrl(existing, row.url)) {
      duplicateCount += 1;
      continue;
    }

    drafts.push({
      id: `${drafts.length}-${normalized.normalized}`,
      url: normalized.normalized,
      label: row.label.trim() || guessLabelFromUrl(normalized.normalized),
      tags: row.tags,
    });
  }

  return { drafts, invalidCount, duplicateCount, truncated };
}

export function readImportFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}
