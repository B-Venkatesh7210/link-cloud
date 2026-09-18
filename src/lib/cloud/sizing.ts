import type { LinkWithTags } from "@/lib/types";

export type BubbleScale = "small" | "medium" | "large";

export function defaultImportanceScore(link: LinkWithTags): number {
  let score = 0;
  if (link.is_favorite) score += 3;

  if (link.last_opened_at) {
    const days =
      (Date.now() - new Date(link.last_opened_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days < 3) score += 2.5;
    else if (days < 14) score += 1.5;
    else if (days < 45) score += 0.5;
  }

  score += Math.min(2.5, Math.log10((link.open_count ?? 0) + 1) * 1.4);
  return score;
}

export function defaultBubbleScale(link: LinkWithTags): BubbleScale {
  const score = defaultImportanceScore(link);
  if (score >= 5) return "large";
  if (score >= 2.2) return "medium";
  return "small";
}

export function defaultBubbleScaleFactor(link: LinkWithTags): number {
  switch (defaultBubbleScale(link)) {
    case "large":
      return 1.08;
    case "medium":
      return 1;
    default:
      return 0.92;
  }
}

/** Search relevance → visual scale. Controlled; never enormous. */
export function searchScaleForRank(rank: number, matched: boolean): number {
  if (!matched) return 0.82;
  if (rank === 0) return 1.55;
  if (rank <= 2) return 1.18;
  if (rank <= 7) return 1.0;
  return 0.88;
}

export function searchOpacityForRank(
  rank: number,
  matched: boolean,
  score: number
): number {
  if (!matched) return 0.16;
  if (rank === 0) return 1;
  if (rank <= 2) return 0.95;
  if (rank <= 7) return 0.78 + Math.min(0.12, score * 0.1);
  return 0.35 + Math.min(0.25, score * 0.2);
}

const TILT_MAX_DEG = 10;

/**
 * Deterministic per-link tilt in [-10°, 10°] from visual_seed.
 * Stable across renders — not re-rolled on every paint.
 */
export function bubbleTiltDegrees(visualSeed: number): number {
  const unit = ((Math.abs(visualSeed) * 2654435761) >>> 0) / 4294967295;
  return Math.round((-TILT_MAX_DEG + unit * (TILT_MAX_DEG * 2)) * 10) / 10;
}
