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

/** Approximate bubble footprint used for packing / collision.
 * Sized for horizontal cards with tags under the label and ±10° tilt. */
export const BUBBLE_FOOTPRINT = {
  small: { width: 250, height: 130 },
  medium: { width: 290, height: 140 },
  large: { width: 330, height: 150 },
} as const;

/** Tighter gap so ~12–20 links stay in one screen. */
export const DEFAULT_SPACING = 52;

/** Extra margin around content for pan clamp / fit padding feel. */
export const CLOUD_EDGE_PADDING = 140;

/**
 * Preferred on-screen stage at zoom ~1 (camera near origin).
 * New links fill empty gaps here before spilling outward.
 * minY stays below the top search chrome.
 */
export const HOME_STAGE = {
  minX: -620,
  maxX: 620,
  minY: -250,
  maxY: 360,
} as const;

/** Soft keepout under the top search bar when home camera is near origin. */
const TOP_CHROME_KEEPOUT: SizedBox = {
  x: -720,
  y: -440,
  width: 1440,
  height: 120,
};

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

function expandStage(
  stage: { minX: number; maxX: number; minY: number; maxY: number },
  factor: number
) {
  const cx = (stage.minX + stage.maxX) / 2;
  const cy = (stage.minY + stage.maxY) / 2;
  const hw = ((stage.maxX - stage.minX) / 2) * factor;
  const hh = ((stage.maxY - stage.minY) / 2) * factor;
  return {
    minX: cx - hw,
    maxX: cx + hw,
    minY: cy - hh,
    maxY: cy + hh,
  };
}

function minCenterDistance(box: SizedBox, occupied: SizedBox[]): number {
  if (occupied.length === 0) return 480;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let min = Infinity;
  for (const other of occupied) {
    const ox = other.x + other.width / 2;
    const oy = other.y + other.height / 2;
    min = Math.min(min, Math.hypot(cx - ox, cy - oy));
  }
  return min;
}

function isPlacementFree(
  box: SizedBox,
  occupied: SizedBox[],
  spacing: number
): boolean {
  if (boxesOverlap(box, TOP_CHROME_KEEPOUT, Math.max(8, spacing * 0.25))) {
    return false;
  }
  return !occupied.some((other) => boxesOverlap(box, other, spacing));
}

/**
 * Compact rings — fallback when the home stage is full.
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
    return isPlacementFree(box, occupied, spacing);
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

/**
 * Priority 1: fill the emptiest free slot on the home stage, then expand outward.
 * Priority 2: `centerBias` pulls important links toward the origin.
 */
export function placeInEmptySpace(options: {
  occupied: SizedBox[];
  size?: { width: number; height: number };
  spacing?: number;
  /** 0 = empty-fill first; 1 = strongly prefer center (top-ranked links). */
  centerBias?: number;
  visualSeed?: number;
}): Point {
  const size = options.size ?? BUBBLE_FOOTPRINT.medium;
  const spacing = options.spacing ?? DEFAULT_SPACING;
  const centerBias = Math.min(1, Math.max(0, options.centerBias ?? 0.2));
  const rand = mulberry32(options.visualSeed ?? 1);

  if (options.occupied.length === 0) {
    return resolveCollision(
      candidateFromSeed(options.visualSeed ?? 1, 0),
      size,
      [],
      spacing
    );
  }

  const stepX = size.width * 0.52;
  const stepY = size.height * 0.52;

  for (let expand = 1; expand <= 5; expand += 1) {
    const stage = expandStage(HOME_STAGE, expand);
    let best: Point | null = null;
    let bestScore = -Infinity;

    for (let y = stage.minY; y <= stage.maxY - size.height; y += stepY) {
      for (let x = stage.minX; x <= stage.maxX - size.width; x += stepX) {
        const jx = x + (rand() - 0.5) * stepX * 0.4;
        const jy = y + (rand() - 0.5) * stepY * 0.4;
        const box: SizedBox = {
          x: jx,
          y: jy,
          width: size.width,
          height: size.height,
        };
        if (!isPlacementFree(box, options.occupied, spacing)) continue;

        const cx = jx + size.width / 2;
        const cy = jy + size.height / 2;
        const separation = minCenterDistance(box, options.occupied);
        const radial = Math.hypot(cx, cy);
        const onHome = expand === 1 ? 1 : 0;

        // Empty gaps first (especially on-screen), then importance→center.
        const score =
          onHome * 8000 +
          separation * 14 +
          -radial * (1.5 + centerBias * 18) +
          rand() * 4;

        if (score > bestScore) {
          bestScore = score;
          best = { x: jx, y: jy };
        }
      }
    }

    if (best) {
      return { x: round2(best.x), y: round2(best.y) };
    }
  }

  return resolveCollision(
    candidateFromSeed(options.visualSeed ?? 1, options.occupied.length),
    size,
    options.occupied,
    spacing
  );
}

export function placeNewLink(options: {
  visualSeed: number;
  existingCount: number;
  occupied: SizedBox[];
  size?: { width: number; height: number };
  spacing?: number;
  /** When set, biases toward center (used by ranked packing). */
  centerBias?: number;
}): Point {
  const size = options.size ?? BUBBLE_FOOTPRINT.medium;
  return placeInEmptySpace({
    occupied: options.occupied,
    size,
    spacing: options.spacing ?? DEFAULT_SPACING,
    visualSeed: options.visualSeed ^ (options.existingCount * 7919),
    centerBias: options.centerBias ?? 0.18,
  });
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

/** How many bubbles comfortably fill one screen at zoom ~1. */
export function homeLinkCapacity(viewport: {
  width: number;
  height: number;
}): number {
  const usableW = Math.max(320, viewport.width - 96);
  const usableH = Math.max(280, viewport.height - 180);
  const cellW = BUBBLE_FOOTPRINT.medium.width + DEFAULT_SPACING;
  const cellH = BUBBLE_FOOTPRINT.medium.height + DEFAULT_SPACING;
  const estimated = Math.floor(((usableW * usableH) / (cellW * cellH)) * 0.5);
  return Math.max(8, Math.min(24, estimated));
}

export type CloudRankable = {
  id: string;
  open_count: number;
  last_opened_at: string | null;
  is_favorite: boolean;
  created_at: string;
  visual_seed: number;
};

/**
 * Most opened / recent first; if nobody has opens yet, sheet/list order
 * (created_at ascending) wins so import tops sit at the center.
 */
export function compareCloudPriority(a: CloudRankable, b: CloudRankable): number {
  if (a.open_count !== b.open_count) return b.open_count - a.open_count;
  const aOpen = a.last_opened_at ? Date.parse(a.last_opened_at) : 0;
  const bOpen = b.last_opened_at ? Date.parse(b.last_opened_at) : 0;
  if (aOpen !== bOpen) return bOpen - aOpen;
  if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function sortLinksForCloud<T extends CloudRankable>(links: T[]): T[] {
  return [...links].sort(compareCloudPriority);
}

/** Camera target: centroid of the top-priority bubbles (home cluster). */
export function homeFocusPoint(
  links: Array<
    CloudRankable & { position_x: number; position_y: number }
  >,
  capacity: number
): Point {
  if (links.length === 0) return { x: 0, y: 40 };

  const ranked = sortLinksForCloud(links).slice(
    0,
    Math.min(capacity, links.length)
  );
  const hw = BUBBLE_FOOTPRINT.medium.width / 2;
  const hh = BUBBLE_FOOTPRINT.medium.height / 2;
  const cx =
    ranked.reduce((sum, link) => sum + link.position_x + hw, 0) / ranked.length;
  const cy =
    ranked.reduce((sum, link) => sum + link.position_y + hh, 0) / ranked.length;

  return { x: round2(cx), y: round2(cy) };
}

/** Assign collision-free positions in priority order (center = most important). */
export function packRankedPositions(
  links: CloudRankable[]
): Array<{
  id: string;
  position_x: number;
  position_y: number;
  visual_seed: number;
}> {
  const ranked = sortLinksForCloud(links);
  const occupied: SizedBox[] = [];

  return ranked.map((link, index) => {
    // Top ranks hug the center; later ranks prioritize remaining empty gaps.
    const centerBias = Math.max(0, 1 - index / 10);
    const point = placeNewLink({
      visualSeed: link.visual_seed,
      existingCount: index,
      occupied,
      centerBias,
    });
    occupied.push(toOccupiedBox(point));
    return {
      id: link.id,
      position_x: point.x,
      position_y: point.y,
      visual_seed: link.visual_seed,
    };
  });
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
