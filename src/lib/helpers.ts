import {
  BUBBLE_FOOTPRINT,
  placeNewLink,
  toOccupiedBox,
  type SizedBox,
} from "@/lib/cloud/layout";

export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function generateVisualSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) % 1_000_000_000;
}

/** Stable placement avoiding overlap with existing node boxes. */
export function generateCanvasPosition(options?: {
  seed?: number;
  existingCount?: number;
  occupied?: SizedBox[];
}): {
  position_x: number;
  position_y: number;
  visual_seed: number;
} {
  const visual_seed = options?.seed ?? generateVisualSeed();
  const existingCount = options?.existingCount ?? 0;
  const occupied = options?.occupied ?? [];

  const point = placeNewLink({
    visualSeed: visual_seed,
    existingCount,
    occupied,
    size: BUBBLE_FOOTPRINT.medium,
  });

  return {
    position_x: point.x,
    position_y: point.y,
    visual_seed,
  };
}

export function occupiedFromLinks(
  links: Array<{ position_x: number; position_y: number }>
): SizedBox[] {
  return links.map((link) =>
    toOccupiedBox({ x: link.position_x, y: link.position_y })
  );
}

export function getUserFacingError(
  error: unknown,
  fallback = "Something went wrong. Try again."
): string {
  if (error instanceof Error && error.message && !looksLikeDbError(error.message)) {
    return error.message;
  }
  return fallback;
}

function looksLikeDbError(message: string): boolean {
  return /postgres|supabase|rls|violates|constraint|relation|column|permission denied/i.test(
    message
  );
}
