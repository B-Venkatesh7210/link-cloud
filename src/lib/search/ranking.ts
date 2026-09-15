import type { LinkWithTags } from "@/lib/types";
import type { ScoredLink } from "@/lib/search/types";
import { normalizeSearchQuery } from "@/lib/search/types";

/**
 * Pure ranking helpers — textual relevance dominates; usage is a light boost.
 * Kept separate so semantic search can reuse the same post-score blending later.
 */

export function exactTagBoost(link: LinkWithTags, query: string): number {
  const q = normalizeSearchQuery(query);
  if (!q) return 0;
  return link.tags.some((tag) => tag.normalized_name === q) ? 0.35 : 0;
}

export function labelPrefixBoost(link: LinkWithTags, query: string): number {
  const q = normalizeSearchQuery(query);
  if (!q) return 0;
  const label = link.label.trim().toLowerCase();
  if (label === q) return 0.4;
  if (label.startsWith(q)) return 0.28;
  if (label.split(/\s+/).some((part) => part.startsWith(q))) return 0.12;
  return 0;
}

export function usageBoost(link: LinkWithTags): number {
  let boost = 0;
  if (link.is_favorite) boost += 0.06;
  if (link.last_opened_at) {
    const days =
      (Date.now() - new Date(link.last_opened_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days < 2) boost += 0.05;
    else if (days < 14) boost += 0.03;
    else if (days < 45) boost += 0.015;
  }
  boost += Math.min(0.04, Math.log10((link.open_count ?? 0) + 1) * 0.02);
  return boost;
}

export function blendSearchScore(
  fuseScore: number,
  link: LinkWithTags,
  query: string
): number {
  // fuseScore is already inverted (1 - fuse.score): higher is better, 0..1
  const textual = Math.max(0, Math.min(1, fuseScore));
  const boosted =
    textual +
    exactTagBoost(link, query) +
    labelPrefixBoost(link, query) +
    usageBoost(link) * Math.max(0.35, textual);
  return Math.min(1.5, boosted);
}

export function sortEmptyQueryLinks(links: LinkWithTags[]): LinkWithTags[] {
  return [...links].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    const aOpen = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
    const bOpen = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return b.open_count - a.open_count;
  });
}

export function assignRanks(scored: Omit<ScoredLink, "searchRank">[]): ScoredLink[] {
  return [...scored]
    .sort((a, b) => {
      if (a.matched !== b.matched) return a.matched ? -1 : 1;
      return b.searchScore - a.searchScore;
    })
    .map((item, index) => ({ ...item, searchRank: index }));
}
