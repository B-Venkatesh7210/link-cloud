import { PNG } from "pngjs";
import {
  isUsableBrandAccent,
  normalizeAccentHex,
  rgbToHex,
} from "@/lib/cloud/accent-color";
import { isBlockedHostname, isPrivateOrReservedIp } from "@/lib/metadata/ssrf";
import { lookup } from "node:dns/promises";

const MAX_FAVICON_BYTES = 250_000;
const TIMEOUT_MS = 3500;
const USER_AGENT =
  "LinkCloudBot/1.0 (+https://linkcloud.app; metadata; respectful)";

async function resolveAndValidateHost(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked host");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("DNS lookup failed");
  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new Error("Private address blocked");
    }
  }
}

async function fetchFaviconBytes(
  url: string,
  hop = 0
): Promise<Buffer | null> {
  if (hop > 3) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    await resolveAndValidateHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/png,image/x-icon,image/svg+xml,image/*;q=0.8,*/*;q=0.1",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = new URL(location, parsed);
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return null;
        }
        await resolveAndValidateHost(next.hostname);
        return fetchFaviconBytes(next.toString(), hop + 1);
      }

      if (!response.ok) return null;

      const reader = response.body?.getReader();
      if (!reader) {
        const ab = await response.arrayBuffer();
        return Buffer.from(ab).subarray(0, MAX_FAVICON_BYTES);
      }

      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_FAVICON_BYTES) {
          chunks.push(
            value.slice(
              0,
              Math.max(0, MAX_FAVICON_BYTES - (total - value.byteLength))
            )
          );
          break;
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c)));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

function extractPngBuffer(data: Buffer): Buffer | null {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.subarray(0, 8).equals(sig)) return data;
  const idx = data.indexOf(sig);
  if (idx >= 0) return data.subarray(idx);
  return null;
}

function samplePngAccent(pngBuffer: Buffer): string | null {
  try {
    const png = PNG.sync.read(pngBuffer);
    const buckets = new Map<string, number>();

    for (let i = 0; i < png.data.length; i += 4) {
      const r = png.data[i]!;
      const g = png.data[i + 1]!;
      const b = png.data[i + 2]!;
      const a = png.data[i + 3]!;
      if (a < 128) continue;

      // Quantize to keep the map small
      const qr = r >> 4;
      const qg = g >> 4;
      const qb = b >> 4;
      const key = `${qr},${qg},${qb}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    let bestKey: string | null = null;
    let bestScore = 0;

    for (const [key, count] of buckets) {
      const [qr, qg, qb] = key.split(",").map(Number) as [number, number, number];
      const r = qr * 17;
      const g = qg * 17;
      const b = qb * 17;
      const hex = rgbToHex(r, g, b);
      if (!isUsableBrandAccent(hex)) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      // Prefer colorful, frequent pixels
      const score = count * (0.35 + sat);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    if (!bestKey) return null;
    const [qr, qg, qb] = bestKey.split(",").map(Number) as [
      number,
      number,
      number,
    ];
    return rgbToHex(qr * 17, qg * 17, qb * 17);
  } catch {
    return null;
  }
}

function sampleSvgAccent(text: string): string | null {
  const matches = text.matchAll(
    /(?:fill|stroke|stop-color|flood-color)\s*[:=]\s*["']?([^"'\s>]+)/gi
  );
  const counts = new Map<string, number>();
  for (const match of matches) {
    const hex = normalizeAccentHex(match[1] ?? "");
    if (!hex || !isUsableBrandAccent(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [hex, count] of counts) {
    if (count > bestCount) {
      best = hex;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Dominant usable brand color from a favicon URL (PNG / ICO-with-PNG / SVG).
 */
export async function sampleFaviconAccent(
  faviconUrl: string | null | undefined,
  pageUrl?: string | null
): Promise<string | null> {
  const candidates: string[] = [];
  if (faviconUrl) candidates.push(faviconUrl);
  if (pageUrl) {
    try {
      const origin = new URL(pageUrl).origin;
      candidates.push(`${origin}/favicon.ico`);
      candidates.push(`${origin}/apple-touch-icon.png`);
    } catch {
      // ignore
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    const bytes = await fetchFaviconBytes(candidate);
    if (!bytes || bytes.length < 8) continue;

    const asText = bytes.toString("utf8", 0, Math.min(bytes.length, 4000));
    if (/<svg[\s>]/i.test(asText) || asText.includes("xmlns")) {
      const fromSvg = sampleSvgAccent(asText);
      if (fromSvg) return fromSvg;
    }

    const png = extractPngBuffer(bytes);
    if (png) {
      const fromPng = samplePngAccent(png);
      if (fromPng) return fromPng;
    }
  }

  return null;
}
