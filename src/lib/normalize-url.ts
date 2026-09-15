const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "chrome:",
  "chrome-extension:",
  "about:",
  "blob:",
  "vbscript:",
]);

export type NormalizedUrl = {
  original: string;
  normalized: string;
  hostname: string;
  faviconUrl: string | null;
};

export class UrlNormalizationError extends Error {
  constructor(message = "That doesn't look like a valid URL.") {
    super(message);
    this.name = "UrlNormalizationError";
  }
}

function ensureProtocol(input: string): string {
  const trimmed = input.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Safely normalize user-entered URLs for storage and deduplication.
 * Keeps path and query intact; only applies conservative cleanup.
 */
export function normalizeUrl(input: string): NormalizedUrl {
  const original = input.trim();
  if (!original) {
    throw new UrlNormalizationError();
  }

  const withProtocol = ensureProtocol(original);
  const lowerProtocol = withProtocol.slice(0, withProtocol.indexOf(":") + 1).toLowerCase();

  if (BLOCKED_PROTOCOLS.has(lowerProtocol)) {
    throw new UrlNormalizationError("That doesn't look like a valid URL.");
  }

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new UrlNormalizationError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlNormalizationError();
  }

  if (!parsed.hostname || parsed.hostname.includes(" ")) {
    throw new UrlNormalizationError();
  }

  parsed.hash = "";

  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  parsed.hostname = parsed.hostname.toLowerCase();

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  }

  const normalized = parsed.toString();
  const hostname = parsed.hostname;
  const faviconUrl: string | null = null;

  return {
    original,
    normalized,
    hostname,
    faviconUrl,
  };
}

export function isValidHttpUrl(input: string): boolean {
  try {
    normalizeUrl(input);
    return true;
  } catch {
    return false;
  }
}
