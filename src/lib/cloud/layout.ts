export type Point = { x: number; y: number };

export type SizedBox = Point & {
  width: number;
  height: number;
};

export type ContentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Approximate bubble footprint used for packing / collision. */
export const BUBBLE_FOOTPRINT = {
  small: { width: 168, height: 78 },
  medium: { width: 196, height: 88 },
  large: { width: 228, height: 98 },
} as const;

/** Tighter gap so ~12–20 links stay in one screen. */
export const DEFAULT_SPACING = 52;

/** Extra margin around content for pan clamp / fit padding feel. */
export const CLOUD_EDGE_PADDING = 140;

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

/**
 * Compact rings first — small clouds stay near the origin so one
 * desktop viewport can frame them. Grows only as count rises.
 */
function ringRadius(index: number): number {
  if (index < 8) return 120;
  if (index < 16) return 230;
  if (index < 28) return 360;
  if (index < 42) return 510;
  return 510 + Math.floor((index - 42) / 16) * 150;
}

/**
 * Deterministic candidate from visual_seed + existing count.
 * Early rings fill a comfortable single viewport; later rings expand.
 */
export function candidateFromSeed(
  visualSeed: number,
  existingCount: number
): Point {
  const rand = mulberry32(visualSeed ^ (existingCount * 9973));
  const radius = ringRadius(existingCount) + (rand() - 0.5) * 28;
  const angle =
    ((visualSeed % 360) / 360) * Math.PI * 2 +
    existingCount * 2.399963 +
    rand() * 0.28;

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

/** Axis-aligned union of bubble boxes. */
export function contentBoundsFromBoxes(
  boxes: SizedBox[],
  padding = CLOUD_EDGE_PADDING
): ContentBounds | null {
  if (boxes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/**
 * Pan clamp for React Flow `translateExtent`.
 * Grows with content; for small clouds stays tight so you can't wander
 * into empty infinite sky. When content is smaller than the viewport,
 * the extent stays content-sized (d3-zoom then effectively locks pan).
 */
export function cloudTranslateExtent(
  boxes: SizedBox[],
  options?: { padding?: number }
): [[number, number], [number, number]] {
  const padding = options?.padding ?? CLOUD_EDGE_PADDING;
  const bounds = contentBoundsFromBoxes(boxes, padding);

  if (!bounds) {
    const halfW = 480;
    const halfH = 320;
    return [
      [-halfW, -halfH],
      [halfW, halfH],
    ];
  }

  return [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.maxY],
  ];
}

/** Whether content is larger than a typical visible frame at zoom ~1. */
export function contentOverflowsViewport(
  boxes: SizedBox[],
  viewport: { width: number; height: number },
  padding = CLOUD_EDGE_PADDING
): boolean {
  const bounds = contentBoundsFromBoxes(boxes, padding);
  if (!bounds) return false;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  return w > viewport.width * 0.95 || h > viewport.height * 0.92;
}

/**
 * Temporary presentation positions for search results.
 * Rank 0 is placed so the bubble's visual center sits on the search stage
 * point (0, stageY). Camera centers that point. Others spiral around it.
 * Does NOT mutate persisted coordinates.
 */
export function searchClusterPositions(
  ranks: number[],
  options?: { mobile?: boolean }
): Point[] {
  const mobile = options?.mobile ?? false;
  const hero = BUBBLE_FOOTPRINT.medium;
  // Sit slightly below true viewport center so the search bar doesn't cover it.
  const stageY = mobile ? 28 : 44;
  const center = {
    x: -hero.width / 2,
    y: -hero.height / 2 + stageY,
  };

  return ranks.map((rank) => {
    if (rank === 0) {
      return { ...center };
    }

    const ring = Math.ceil(rank / (mobile ? 3 : 5));
    const indexInRing = mobile
      ? (rank - 1) % 3
      : (rank - 1) % 5;
    const countInRing = mobile ? 3 : 5;
    const radius = mobile ? 150 + ring * 160 : 200 + ring * 200;
    const angle =
      -Math.PI / 2 +
      ((indexInRing + 0.5) / countInRing) * Math.PI * 2 +
      ring * 0.18;

    return {
      x: Math.cos(angle) * radius - hero.width / 2,
      y: Math.sin(angle) * radius * (mobile ? 1.05 : 0.82) - hero.height / 2 + stageY,
    };
  });
}

/** Flow-space point the search camera should lock onto (hero visual center). */
export function searchStageCenter(options?: { mobile?: boolean }): Point {
  return { x: 0, y: options?.mobile ? 28 : 44 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
