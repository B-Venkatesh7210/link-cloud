const AVATAR_PALETTES = [
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-slate-100", text: "text-slate-700" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
] as const;

export function domainInitial(hostname: string): string {
  const host = hostname.replace(/^www\./, "").trim();
  const first = host.charAt(0);
  return (first || "L").toUpperCase();
}

export function domainAvatarStyle(
  hostname: string,
  visualSeed?: number
): { bg: string; text: string; initial: string } {
  const seed =
    visualSeed ??
    Array.from(hostname).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palette = AVATAR_PALETTES[Math.abs(seed) % AVATAR_PALETTES.length]!;
  return {
    ...palette,
    initial: domainInitial(hostname),
  };
}
