import Fuse, { type IFuseOptions } from "fuse.js";
import type { LinkWithTags } from "@/lib/types";
import {
  searchOpacityForRank,
  searchScaleForRank,
  defaultBubbleScaleFactor,
} from "@/lib/cloud/sizing";
import { searchClusterPositions } from "@/lib/cloud/layout";
import {
  assignRanks,
  blendSearchScore,
  sortEmptyQueryLinks,
} from "@/lib/search/ranking";
import type { ScoredLink, SearchProvider } from "@/lib/search/types";
import { normalizeSearchQuery } from "@/lib/search/types";

export type { ScoredLink } from "@/lib/search/types";

export type PresentableLink = ScoredLink & {
  displayX: number;
  displayY: number;
  scale: number;
  opacity: number;
  recentEmphasis: boolean;
};

const fuseOptions: IFuseOptions<LinkWithTags> = {
  includeScore: true,
  threshold: 0.36,
  ignoreLocation: true,
  keys: [
    { name: "label", weight: 5 },
    { name: "tags.name", weight: 4.5 },
    { name: "page_title", weight: 3 },
    { name: "hostname", weight: 2.2 },
    { name: "notes", weight: 1.5 },
    { name: "url", weight: 1 },
  ],
};

export const localFuzzySearchProvider: SearchProvider = {
  search(links, query) {
    const trimmed = normalizeSearchQuery(query);

    if (!trimmed) {
      return sortEmptyQueryLinks(links).map((link, index) => ({
        ...link,
        searchScore: 1,
        searchRank: index,
        matched: true,
      }));
    }

    const fuse = new Fuse(links, fuseOptions);
    const results = fuse.search(trimmed);
    const matchedIds = new Set(results.map((r) => r.item.id));

    const matchedBase = results.map((result) => {
      const fuseInverted = 1 - (result.score ?? 1);
      return {
        ...result.item,
        searchScore: blendSearchScore(fuseInverted, result.item, trimmed),
        matched: true as const,
      };
    });

    const unmatchedBase = links
      .filter((link) => !matchedIds.has(link.id))
      .map((link) => ({
        ...link,
        searchScore: 0,
        matched: false as const,
      }));

    return assignRanks([...matchedBase, ...unmatchedBase]);
  },
};

let activeProvider: SearchProvider = localFuzzySearchProvider;

export function setSearchProvider(provider: SearchProvider) {
  activeProvider = provider;
}

export function getSearchProvider(): SearchProvider {
  return activeProvider;
}

export function searchLinks(
  links: LinkWithTags[],
  query: string
): ScoredLink[] {
  return activeProvider.search(links, query);
}

export function presentLinks(
  links: LinkWithTags[],
  query: string,
  options?: { mobile?: boolean }
): PresentableLink[] {
  const scored = searchLinks(links, query);
  const searching = normalizeSearchQuery(query).length > 0;

  if (!searching) {
    const recentIds = new Set(
      sortEmptyQueryLinks(links)
        .filter((l) => l.last_opened_at)
        .slice(0, 5)
        .map((l) => l.id)
    );

    return scored.map((link) => ({
      ...link,
      displayX: link.position_x,
      displayY: link.position_y,
      scale: defaultBubbleScaleFactor(link) * (recentIds.has(link.id) ? 1.04 : 1),
      opacity: 1,
      recentEmphasis: recentIds.has(link.id),
    }));
  }

  const matched = scored.filter((l) => l.matched);
  const cluster = searchClusterPositions(
    matched.map((l) => l.searchRank),
    { mobile: options?.mobile }
  );

  const clusterById = new Map(
    matched.map((link, i) => [link.id, cluster[i]!] as const)
  );

  return scored.map((link) => {
    if (link.matched) {
      const point = clusterById.get(link.id)!;
      return {
        ...link,
        displayX: point.x,
        displayY: point.y,
        scale: searchScaleForRank(link.searchRank, true),
        opacity: searchOpacityForRank(
          link.searchRank,
          true,
          link.searchScore
        ),
        recentEmphasis: false,
      };
    }

    const angle = ((link.visual_seed % 360) / 360) * Math.PI * 2;
    return {
      ...link,
      displayX: link.position_x + Math.cos(angle) * 40,
      displayY: link.position_y + Math.sin(angle) * 28,
      scale: searchScaleForRank(link.searchRank, false),
      opacity: searchOpacityForRank(link.searchRank, false, 0),
      recentEmphasis: false,
    };
  });
}

export function topSearchMatch(
  links: LinkWithTags[],
  query: string
): ScoredLink | null {
  if (!normalizeSearchQuery(query)) return null;
  const scored = searchLinks(links, query).filter((l) => l.matched);
  return scored[0] ?? null;
}

export function isStrongTopMatch(match: ScoredLink | null): boolean {
  return Boolean(match && match.matched && match.searchScore >= 0.55);
}
