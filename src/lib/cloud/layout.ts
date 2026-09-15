export type Point = { x: number; y: number };

export type SizedBox = Point & {
  width: number;
  height: number;
};

/** Approximate bubble footprint used for packing / collision. */
export const BUBBLE_FOOTPRINT = {
  small: { width: 168, height: 78 },
  medium: { width: 196, height: 88 },
  large: { width: 228, height: 98 },
} as const;

export const DEFAULT_SPACING = 88;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function boxesOverlap(a: SizedBox, b: SizedBox, padding: number): boolean {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

function ringRadius(index: number): number {
  if (index < 6) return 210;
  if (index < 14) return 420;
  if (index < 24) return 640;
  if (index < 36) return 880;
  return 880 + Math.floor((index - 36) / 14) * 240;
}

/**
 * Deterministic candidate from visual_seed + existing count.
 * Spread across rings so ~20–30 nodes fill a comfortable desktop viewport.
 */
export function candidateFromSeed(
  visualSeed: number,
  existingCount: number
): Point {
  const rand = mulberry32(visualSeed ^ (existingCount * 9973));
  const radius = ringRadius(existingCount) + (rand() - 0.5) * 40;
  const angle =
    ((visualSeed % 360) / 360) * Math.PI * 2 +
    existingCount * 2.399963 +
    rand() * 0.35;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.78,
  };
}

export function resolveCollision(
  candidate: Point,
  size: { width: number; height: number },
  occupied: SizedBox[],
  spacing = DEFAULT_SPACING
): Point {
  const width = size.width;
  const height = size.height;
  const best = { x: candidate.x - width / 2, y: candidate.y - height / 2 };

  const tryPoint = (x: number, y: number) => {
    const box: SizedBox = { x, y, width, height };
    return !occupied.some((other) => boxesOverlap(box, other, spacing));
  };

  if (tryPoint(best.x, best.y)) {
    return { x: round2(best.x), y: round2(best.y) };
  }

  for (let ring = 1; ring <= 28; ring += 1) {
    const steps = 8 + ring * 4;
    const dist = spacing * 0.55 * ring;
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2 + ring * 0.2;
      const x = candidate.x - width / 2 + Math.cos(angle) * dist;
      const y = candidate.y - height / 2 + Math.sin(angle) * dist * 0.85;
      if (tryPoint(x, y)) {
        return { x: round2(x), y: round2(y) };
      }
    }
  }

  return { x: round2(best.x), y: round2(best.y) };
}

export function placeNewLink(options: {
  visualSeed: number;
  existingCount: number;
  occupied: SizedBox[];
  size?: { width: number; height: number };
  spacing?: number;
}): Point {
  const size = options.size ?? BUBBLE_FOOTPRINT.medium;
  const candidate = candidateFromSeed(options.visualSeed, options.existingCount);
  return resolveCollision(
    candidate,
    size,
    options.occupied,
    options.spacing ?? DEFAULT_SPACING
  );
}

export function toOccupiedBox(
  position: Point,
  size: { width: number; height: number } = BUBBLE_FOOTPRINT.medium
): SizedBox {
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };
}

/**
 * Temporary presentation positions for search results.
 * Rank 0 sits near visual center; others spiral outward.
 * Does NOT mutate persisted coordinates.
 */
export function searchClusterPositions(
  ranks: number[],
  options?: { mobile?: boolean }
): Point[] {
  const mobile = options?.mobile ?? false;
  const center = mobile ? { x: -40, y: 40 } : { x: 0, y: 36 };

  return ranks.map((rank) => {
    if (rank === 0) {
      return { ...center };
    }

    const ring = Math.ceil(rank / (mobile ? 3 : 5));
    const indexInRing = mobile
      ? (rank - 1) % 3
      : (rank - 1) % 5;
    const countInRing = mobile ? 3 : 5;
    const radius = mobile ? 130 + ring * 150 : 160 + ring * 190;
    const angle =
      -Math.PI / 2 +
      ((indexInRing + 0.5) / countInRing) * Math.PI * 2 +
      ring * 0.18;

    return {
      x: center.x + Math.cos(angle) * radius - 90,
      y: center.y + Math.sin(angle) * radius * (mobile ? 1.05 : 0.82) - 40,
    };
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
