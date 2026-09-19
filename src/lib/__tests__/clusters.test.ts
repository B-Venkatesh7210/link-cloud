import { describe, expect, it } from "vitest";
import { buildHeuristicTree } from "@/lib/clusters/heuristic";
import {
  countClusterLinks,
  normalizeClusterTree,
} from "@/lib/clusters/normalize";
import { MIN_CLUSTER_SIZE } from "@/lib/clusters/constants";

describe("normalizeClusterTree", () => {
  it("dissolves named clusters below min size into Unnamed", () => {
    const roots = [
      {
        name: "Tiny",
        linkIds: ["a", "b"],
        children: [],
      },
      {
        name: "Big Enough",
        linkIds: Array.from({ length: MIN_CLUSTER_SIZE }, (_, i) => `b${i}`),
        children: [],
      },
    ];
    const all = ["a", "b", ...roots[1]!.linkIds];
    const out = normalizeClusterTree(roots, all);
    const named = out.filter((n) => n.name != null);
    const unnamed = out.find((n) => n.name == null);
    expect(named).toHaveLength(1);
    expect(named[0]!.name).toBe("Big Enough");
    expect(unnamed?.linkIds.sort()).toEqual(["a", "b"]);
  });

  it("keeps nested structure when children meet min size", () => {
    const childIds = Array.from({ length: MIN_CLUSTER_SIZE }, (_, i) => `c${i}`);
    const roots = [
      {
        name: "Parent",
        linkIds: Array.from({ length: MIN_CLUSTER_SIZE }, (_, i) => `p${i}`),
        children: [
          {
            name: "Child",
            linkIds: childIds,
            children: [],
          },
        ],
      },
    ];
    const all = [...roots[0]!.linkIds, ...childIds];
    const out = normalizeClusterTree(roots, all);
    expect(out).toHaveLength(1);
    expect(out[0]!.children).toHaveLength(1);
    expect(countClusterLinks(out[0]!)).toBe(all.length);
  });
});

describe("buildHeuristicTree", () => {
  it("groups by hostname when enough links share a host", () => {
    const links = Array.from({ length: MIN_CLUSTER_SIZE }, (_, i) => ({
      id: `g${i}`,
      hostname: "github.com",
      label: `Repo ${i}`,
      tags: [] as string[],
    }));
    links.push({
      id: "solo",
      hostname: "example.com",
      label: "Solo",
      tags: [],
    });
    const tree = buildHeuristicTree(links);
    const github = tree.find((n) => n.name?.toLowerCase().includes("github"));
    const unnamed = tree.find((n) => n.name == null);
    expect(github?.linkIds).toHaveLength(MIN_CLUSTER_SIZE);
    expect(unnamed?.linkIds).toContain("solo");
  });
});
