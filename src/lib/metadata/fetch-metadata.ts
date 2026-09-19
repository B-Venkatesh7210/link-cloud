import { lookup } from "node:dns/promises";
import { isBlockedHostname, isPrivateOrReservedIp } from "@/lib/metadata/ssrf";
import {
  isUsableBrandAccent,
  normalizeAccentHex,
} from "@/lib/cloud/accent-color";
import { sampleFaviconAccent } from "@/lib/metadata/sample-favicon-color";
import { normalizeUrl, UrlNormalizationError } from "@/lib/normalize-url";

export type UrlMetadata = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  faviconUrl: string | null;
  themeColor: string | null;
  finalUrl: string;
  hostname: string;
};

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 4500;
const MAX_BYTES = 1_000_000;
const USER_AGENT =
  "LinkCloudBot/1.0 (+https://linkcloud.app; metadata; respectful)";

async function resolveAndValidateHost(hostname: string): Promise<string[]> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked host");
  }

  // If hostname is already an IP literal
  if (isPrivateOrReservedIp(hostname) === false && /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    // public IPv4 literal — still validate
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("DNS lookup failed");
  }

  if (!addresses.length) {
    throw new Error("DNS lookup failed");
  }

  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new Error("Private address blocked");
    }
  }

  return addresses.map((a) => a.address);
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match?.[1]) return decodeHtmlEntities(match[1]);
  return null;
}

function extractFavicon(html: string, baseUrl: URL): string | null {
  const iconMatch =
    html.match(
      /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["'][^>]*>/i
    ) ||
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*>/i
    );

  if (!iconMatch?.[1]) return null;
  try {
    return new URL(iconMatch[1], baseUrl).toString();
  } catch {
    return null;
  }
}

function extractThemeColor(html: string): string | null {
  const candidates = [
    extractMeta(html, "theme-color"),
    extractMeta(html, "msapplication-TileColor"),
  ];
  for (const candidate of candidates) {
    const hex = normalizeAccentHex(candidate);
    if (hex && isUsableBrandAccent(hex)) return hex;
  }
  return null;
}

async function safeFetchOnce(url: URL): Promise<Response> {
  await resolveAndValidateHost(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)
  ) {
    throw new Error("Unsupported content type");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, MAX_BYTES);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      chunks.push(value.slice(0, Math.max(0, MAX_BYTES - (total - value.byteLength))));
      break;
    }
    chunks.push(value);
  }

  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return merged.toString("utf8");
}

/**
 * Safely fetch public URL metadata for label suggestions.
 * Never throws to callers for network failures — returns null.
 */
export async function fetchUrlMetadata(
  inputUrl: string
): Promise<UrlMetadata | null> {
  try {
    const normalized = normalizeUrl(inputUrl);
    let current = new URL(normalized.normalized);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await safeFetchOnce(current);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) {
          return null;
        }
        const next = new URL(location, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return null;
        }
        // Re-validate destination host before following
        await resolveAndValidateHost(next.hostname);
        current = next;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const html = await readLimitedText(response);
      const title = truncate(extractTitle(html), 200);
      const description = truncate(
        extractMeta(html, "og:description") || extractMeta(html, "description"),
        500
      );
      const siteName = truncate(extractMeta(html, "og:site_name"), 120);
      const pageFavicon = extractFavicon(html, current);
      let themeColor = extractThemeColor(html);

      if (!themeColor) {
        themeColor = await sampleFaviconAccent(
          pageFavicon,
          current.toString()
        );
      }

      return {
        title,
        description,
        siteName,
        faviconUrl: pageFavicon,
        themeColor,
        finalUrl: current.toString(),
        hostname: current.hostname,
      };
    }

    return null;
  } catch (error) {
    if (error instanceof UrlNormalizationError) return null;
    return null;
  }
}

export function suggestedLabelFromMetadata(
  metadata: UrlMetadata | null,
  hostnameFallback: string
): string {
  if (metadata?.title) return metadata.title;
  return hostnameFallback.replace(/^www\./, "");
}
