import { MIN_CLUSTER_SIZE } from "@/lib/clusters/constants";
import type { ClusterTreeNode } from "@/lib/clusters/types";

export type HeuristicLink = {
  id: string;
  hostname: string;
  label: string;
  tags: string[];
};

function registrableHost(hostname: string): string {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  // naive eTLD+1 — good enough for clustering tests
  return parts.slice(-2).join(".");
}

/**
 * Group by hostname; large hosts become named clusters.
 * Optional second pass: tag co-occurrence for leftovers (≥ min size).
 */
export function buildHeuristicTree(links: HeuristicLink[]): ClusterTreeNode[] {
  const byHost = new Map<string, string[]>();
  for (const link of links) {
    const key = registrableHost(link.hostname || "unknown");
    const list = byHost.get(key) ?? [];
    list.push(link.id);
    byHost.set(key, list);
  }

  const roots: ClusterTreeNode[] = [];
  const leftovers: string[] = [];

  for (const [host, ids] of byHost) {
    if (ids.length >= MIN_CLUSTER_SIZE) {
      const name = host
        .split(".")[0]
        ?.replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      roots.push({
        name: name || host,
        linkIds: ids,
        children: [],
      });
    } else {
      leftovers.push(...ids);
    }
  }

  // Tag buckets for leftovers
  const byTag = new Map<string, string[]>();
  const leftoverSet = new Set(leftovers);
  for (const link of links) {
    if (!leftoverSet.has(link.id)) continue;
    for (const tag of link.tags) {
      const key = tag.trim().toLowerCase();
      if (!key) continue;
      const list = byTag.get(key) ?? [];
      list.push(link.id);
      byTag.set(key, list);
    }
  }

  const stillLoose = new Set(leftovers);
  for (const [tag, ids] of byTag) {
    const unique = [...new Set(ids)].filter((id) => stillLoose.has(id));
    if (unique.length < MIN_CLUSTER_SIZE) continue;
    for (const id of unique) stillLoose.delete(id);
    roots.push({
      name: tag.replace(/\b\w/g, (c) => c.toUpperCase()),
      linkIds: unique,
      children: [],
    });
  }

  if (stillLoose.size > 0) {
    roots.push({
      name: null,
      linkIds: [...stillLoose],
      children: [],
    });
  }

  return roots;
}
