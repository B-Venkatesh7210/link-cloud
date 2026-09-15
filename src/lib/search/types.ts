import type { LinkWithTags } from "@/lib/types";

export type ScoredLink = LinkWithTags & {
  searchScore: number;
  searchRank: number;
  matched: boolean;
};

/**
 * Swappable search contract. MVP: local Fuse.
 * Future: hybrid semantic provider without changing call sites.
 */
export type SearchProvider = {
  search(links: LinkWithTags[], query: string): ScoredLink[];
};

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}
