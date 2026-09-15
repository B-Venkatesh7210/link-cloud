import { describe, expect, it } from "vitest";
import { normalizeUrl, isValidHttpUrl } from "@/lib/normalize-url";
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
  BUBBLE_FOOTPRINT,
} from "@/lib/cloud/layout";
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
});
