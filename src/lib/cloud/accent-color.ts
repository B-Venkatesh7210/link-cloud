/** Fallback hues when a site has no theme-color. */
const FALLBACK_HEX = [
  "#7dd3fc", // sky
  "#94a3b8", // slate
  "#67e8f9", // cyan
  "#93c5fd", // blue
  "#a5b4fc", // indigo
  "#5eead4", // teal
] as const;

export type BubbleSurface = {
  background: string;
  border: string;
  shadow: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function componentToHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const normalized = normalizeAccentHex(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/** Accept #rgb, #rrggbb, rgb(), rgba() → #rrggbb or null. */
export function normalizeAccentHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();

  const hex3 = raw.match(/^#([0-9a-f]{3})$/i);
  if (hex3?.[1]) {
    const [a, b, c] = hex3[1].split("");
    return `#${a}${a}${b}${b}${c}${c}`;
  }

  const hex6 = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex6?.[1]) return `#${hex6[1]}`;

  const hex8 = raw.match(/^#([0-9a-f]{8})$/i);
  if (hex8?.[1]) return `#${hex8[1].slice(0, 6)}`;

  const rgb = raw.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/i
  );
  if (rgb) {
    return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  return null;
}

export function fallbackAccentFromSeed(visualSeed: number): string {
  const index = Math.abs(visualSeed) % FALLBACK_HEX.length;
  return FALLBACK_HEX[index]!;
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(rgb: {
  r: number;
  g: number;
  b: number;
}): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

/**
 * True when a color works as a brand tint (not black / white / mud grey).
 * Black theme-colors wash into identical taupe after lightening.
 */
export function isUsableBrandAccent(input: string | null | undefined): boolean {
  const hex = normalizeAccentHex(input);
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return false;

  const lum = relativeLuminance(rgb);
  if (lum < 0.1) return false; // black / near-black
  if (lum > 0.92) return false; // near-white

  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const sat = max === 0 ? 0 : (max - min) / max;
  // Dark desaturated greys also become muddy taupe
  if (sat < 0.14 && lum < 0.45) return false;
  if (sat < 0.06) return false;

  return true;
}

/** Missing or unusable accents should be (re)enriched. */
export function needsAccentEnrichment(
  accent: string | null | undefined
): boolean {
  return !isUsableBrandAccent(accent);
}

function mixWithWhite(
  rgb: { r: number; g: number; b: number },
  amount: number
): { r: number; g: number; b: number } {
  const t = clamp(amount, 0, 1);
  return {
    r: rgb.r + (255 - rgb.r) * t,
    g: rgb.g + (255 - rgb.g) * t,
    b: rgb.b + (255 - rgb.b) * t,
  };
}

function darken(
  rgb: { r: number; g: number; b: number },
  amount: number
): { r: number; g: number; b: number } {
  const t = 1 - clamp(amount, 0, 1);
  return {
    r: rgb.r * t,
    g: rgb.g * t,
    b: rgb.b * t,
  };
}

/**
 * Light tint fill + darker border from a brand hex.
 * Falls back to a soft sky surface when the color is unusable.
 */
export function bubbleSurfaceFromAccent(
  accent: string | null | undefined
): BubbleSurface {
  const hex = normalizeAccentHex(accent);
  const rgb = hex ? hexToRgb(hex) : null;

  if (!rgb) {
    return {
      background: "rgba(255, 255, 255, 0.78)",
      border: "rgba(255, 255, 255, 0.8)",
      shadow: "0 10px 30px rgba(70, 120, 180, 0.10)",
    };
  }

  const fill = mixWithWhite(rgb, 0.88);
  const border = darken(rgb, 0.28);
  const glow = mixWithWhite(rgb, 0.35);

  return {
    background: `rgba(${Math.round(fill.r)}, ${Math.round(fill.g)}, ${Math.round(fill.b)}, 0.9)`,
    border: `rgba(${Math.round(border.r)}, ${Math.round(border.g)}, ${Math.round(border.b)}, 0.55)`,
    shadow: `0 10px 30px rgba(${Math.round(glow.r)}, ${Math.round(glow.g)}, ${Math.round(glow.b)}, 0.22)`,
  };
}
