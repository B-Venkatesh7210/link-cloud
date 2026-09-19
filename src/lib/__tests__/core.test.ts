import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  isValidHttpUrl,
  findLinkByUrl,
  normalizedUrlVariants,
} from "@/lib/normalize-url";
import { isBlockedHostname, isPrivateOrReservedIp } from "@/lib/metadata/ssrf";
import { normalizeTagName, displayTagName } from "@/lib/helpers";
import {
  blendSearchScore,
  exactTagBoost,
  labelPrefixBoost,
} from "@/lib/search/ranking";
import {
  placeNewLink,
  resolveCollision,
  toOccupiedBox,
  cloudTranslateExtent,
  contentOverflowsViewport,
  homeLinkCapacity,
  homeFocusPoint,
  sortLinksForCloud,
  packRankedPositions,
  BUBBLE_FOOTPRINT,
} from "@/lib/cloud/layout";
import { parseLinksFile } from "@/lib/import/parse-links-file";
import { bubbleTiltDegrees } from "@/lib/cloud/sizing";
import {
  bubbleSurfaceFromAccent,
  normalizeAccentHex,
  fallbackAccentFromSeed,
  isUsableBrandAccent,
  needsAccentEnrichment,
} from "@/lib/cloud/accent-color";
import type { LinkWithTags } from "@/lib/types";

function fakeLink(partial: Partial<LinkWithTags> & Pick<LinkWithTags, "id" | "label">): LinkWithTags {
  return {
    user_id: "u1",
    url: "https://example.com",
    normalized_url: "https://example.com/",
    page_title: null,
    hostname: "example.com",
    description: null,
    notes: null,
    favicon_url: null,
    accent_color: null,
    position_x: 0,
    position_y: 0,
    visual_seed: 1,
    open_count: 0,
    last_opened_at: null,
    is_favorite: false,
    archived_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    ...partial,
  };
}

describe("normalizeUrl", () => {
  it("adds https and lowercases host", () => {
    const result = normalizeUrl("Example.COM/Path/");
    expect(result.hostname).toBe("example.com");
    expect(result.normalized.startsWith("https://")).toBe(true);
    expect(result.normalized).not.toMatch(/\/$/);
  });

  it("keeps meaningful query params", () => {
    const result = normalizeUrl("https://example.com/report?id=42&tab=usage");
    expect(result.normalized).toContain("id=42");
    expect(result.normalized).toContain("tab=usage");
  });

  it("rejects dangerous protocols", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("matches www and non-www as the same saved link", () => {
    const variants = normalizedUrlVariants(
      normalizeUrl("https://www.example.com/app").normalized
    );
    expect(variants.some((v) => v.includes("://example.com/"))).toBe(true);
    expect(variants.some((v) => v.includes("://www.example.com/"))).toBe(true);

    const links = [
      fakeLink({
        id: "1",
        label: "Example",
        url: "https://www.example.com/app",
        normalized_url: "https://www.example.com/app",
        hostname: "www.example.com",
      }),
    ];
    expect(findLinkByUrl(links, "https://example.com/app")?.id).toBe("1");
    expect(findLinkByUrl(links, "example.com/app")?.id).toBe("1");
  });
});

describe("ssrf guards", () => {
  it("blocks localhost and private ranges", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.4")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });
});

describe("tags", () => {
  it("normalizes case-insensitively", () => {
    expect(normalizeTagName("  Production ")).toBe("production");
    expect(displayTagName("  ABC  September ")).toBe("ABC September");
  });
});

describe("search ranking", () => {
  it("boosts exact tag and label prefix", () => {
    const link = fakeLink({
      id: "1",
      label: "ABC September Usage",
      tags: [
        {
          id: "t1",
          user_id: "u1",
          name: "September",
          normalized_name: "september",
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(exactTagBoost(link, "september")).toBeGreaterThan(0);
    expect(labelPrefixBoost(link, "abc")).toBeGreaterThan(0);
    expect(blendSearchScore(0.5, link, "abc september")).toBeGreaterThan(0.5);
  });
});

describe("layout collision", () => {
  it("avoids overlapping occupied boxes", () => {
    const occupied = [
      toOccupiedBox({ x: 0, y: 0 }, BUBBLE_FOOTPRINT.medium),
    ];
    const placed = placeNewLink({
      visualSeed: 42,
      existingCount: 1,
      occupied,
    });
    const resolved = resolveCollision(
      { x: 20, y: 20 },
      BUBBLE_FOOTPRINT.medium,
      occupied
    );
    expect(Number.isFinite(placed.x)).toBe(true);
    expect(Number.isFinite(resolved.x)).toBe(true);
    expect(
      Math.abs(resolved.x) > 50 || Math.abs(resolved.y) > 50
    ).toBe(true);
  });

  it("keeps early links in a compact cloud near the origin", () => {
    const occupied: ReturnType<typeof toOccupiedBox>[] = [];
    const points = [];
    for (let i = 0; i < 8; i += 1) {
      const point = placeNewLink({
        visualSeed: 1000 + i * 97,
        existingCount: i,
        occupied,
      });
      points.push(point);
      occupied.push(toOccupiedBox(point));
    }

    const maxDist = Math.max(
      ...points.map((p) =>
        Math.hypot(
          p.x + BUBBLE_FOOTPRINT.medium.width / 2,
          p.y + BUBBLE_FOOTPRINT.medium.height / 2
        )
      )
    );
    // First ring + footprint should stay well inside a typical desktop frame.
    expect(maxDist).toBeLessThan(520);
  });

  it("builds a finite translate extent from content", () => {
    const boxes = [
      toOccupiedBox({ x: -100, y: -80 }),
      toOccupiedBox({ x: 120, y: 40 }),
    ];
    const extent = cloudTranslateExtent(boxes, { padding: 50 });
    expect(extent[0][0]).toBeLessThan(extent[1][0]);
    expect(extent[0][1]).toBeLessThan(extent[1][1]);
    expect(Number.isFinite(extent[0][0])).toBe(true);
    expect(Number.isFinite(extent[1][0])).toBe(true);
    expect(
      contentOverflowsViewport(boxes, { width: 1280, height: 800 }, 50)
    ).toBe(false);
    expect(
      contentOverflowsViewport(
        [
          toOccupiedBox({ x: -900, y: -700 }),
          toOccupiedBox({ x: 900, y: 700 }),
        ],
        { width: 1280, height: 800 },
        50
      )
    ).toBe(true);
  });

  it("ranks opened links ahead of import order", () => {
    const a = fakeLink({
      id: "a",
      label: "A",
      open_count: 0,
      created_at: "2024-01-01T00:00:00.000Z",
    });
    const b = fakeLink({
      id: "b",
      label: "B",
      open_count: 5,
      created_at: "2024-06-01T00:00:00.000Z",
    });
    const c = fakeLink({
      id: "c",
      label: "C",
      open_count: 0,
      created_at: "2024-02-01T00:00:00.000Z",
    });
    expect(sortLinksForCloud([a, b, c]).map((l) => l.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("packs priority links nearer the origin", () => {
    const links = Array.from({ length: 12 }, (_, i) =>
      fakeLink({
        id: `id-${i}`,
        label: `L${i}`,
        open_count: i === 0 ? 10 : 0,
        visual_seed: 100 + i,
        created_at: `2024-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      })
    );
    const packed = packRankedPositions(links);
    const top = packed.find((p) => p.id === "id-0")!;
    const far = packed.find((p) => p.id === "id-11")!;
    const topDist = Math.hypot(top.position_x, top.position_y);
    const farDist = Math.hypot(far.position_x, far.position_y);
    expect(topDist).toBeLessThan(farDist);
  });

  it("estimates a bounded home capacity from viewport size", () => {
    const desktop = homeLinkCapacity({ width: 1440, height: 900 });
    const mobile = homeLinkCapacity({ width: 390, height: 844 });
    expect(desktop).toBeGreaterThanOrEqual(8);
    expect(desktop).toBeLessThanOrEqual(24);
    expect(mobile).toBeLessThanOrEqual(desktop);
    const focus = homeFocusPoint(
      [
        fakeLink({ id: "1", label: "A", position_x: 0, position_y: 0 }),
        fakeLink({ id: "2", label: "B", position_x: 200, position_y: 100 }),
      ],
      8
    );
    expect(Number.isFinite(focus.x)).toBe(true);
  });
});

describe("bubble tilt", () => {
  it("stays within ±10° and is stable for a seed", () => {
    const a = bubbleTiltDegrees(42);
    const b = bubbleTiltDegrees(42);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(-10);
    expect(a).toBeLessThanOrEqual(10);

    const samples = [0, 1, 7, 99, 12345, 999999].map(bubbleTiltDegrees);
    for (const deg of samples) {
      expect(deg).toBeGreaterThanOrEqual(-10);
      expect(deg).toBeLessThanOrEqual(10);
    }
    expect(new Set(samples).size).toBeGreaterThan(1);
  });
});

describe("accent color", () => {
  it("normalizes hex and rgb theme colors", () => {
    expect(normalizeAccentHex("#0af")).toBe("#00aaff");
    expect(normalizeAccentHex("#112233")).toBe("#112233");
    expect(normalizeAccentHex("rgb(17, 34, 51)")).toBe("#112233");
    expect(normalizeAccentHex("default")).toBeNull();
  });

  it("rejects black / near-black theme colors as unusable", () => {
    expect(isUsableBrandAccent("#000000")).toBe(false);
    expect(isUsableBrandAccent("#111111")).toBe(false);
    expect(isUsableBrandAccent("#0066cc")).toBe(true);
    expect(needsAccentEnrichment("#000")).toBe(true);
    expect(needsAccentEnrichment("#3366ff")).toBe(false);
  });

  it("builds a light fill and darker border from an accent", () => {
    const surface = bubbleSurfaceFromAccent("#0066cc");
    expect(surface.background).toMatch(/^rgba\(/);
    expect(surface.border).toMatch(/^rgba\(/);
    expect(fallbackAccentFromSeed(3)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("link file import", () => {
  it("parses txt urls with optional labels and tags", () => {
    const text = [
      "https://supabase.com",
      "https://github.com/org/repo | Work repos",
      "docs.google.com/x  September usage",
      "https://github.com/org/repo",
      "javascript:alert(1)",
    ].join("\n");

    const result = parseLinksFile(text, { filename: "links.txt" });
    expect(result.drafts.length).toBe(3);
    expect(result.drafts[0]?.label).toBe("supabase.com");
    expect(result.drafts[1]?.label).toBe("Work repos");
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidCount).toBe(1);
  });

  it("parses csv with header and skips existing links", () => {
    const text = [
      "url,label,tags",
      "https://example.com/a,Alpha,\"work,prod\"",
      "https://www.example.com/a,Dup",
      "https://example.com/b,Beta,personal",
    ].join("\n");

    const existing = [
      fakeLink({
        id: "1",
        label: "Alpha",
        url: "https://example.com/a",
        normalized_url: "https://example.com/a",
        hostname: "example.com",
      }),
    ];

    const result = parseLinksFile(text, {
      filename: "links.csv",
      existingLinks: existing,
    });
    expect(result.drafts.length).toBe(1);
    expect(result.drafts[0]?.label).toBe("Beta");
    expect(result.drafts[0]?.tags).toContain("personal");
    expect(result.duplicateCount).toBe(2);
  });
});
