import { MIN_CLUSTER_SIZE } from "@/lib/clusters/constants";
import type { ClusterTreeNode } from "@/lib/clusters/types";

export function countClusterLinks(node: ClusterTreeNode): number {
  return (
    node.linkIds.length +
    node.children.reduce((sum, child) => sum + countClusterLinks(child), 0)
  );
}

function flattenLinkIds(node: ClusterTreeNode): string[] {
  return [
    ...node.linkIds,
    ...node.children.flatMap((child) => flattenLinkIds(child)),
  ];
}

/**
 * Enforce uniqueness + min size. Small named groups dissolve into Unnamed.
 */
export function normalizeClusterTree(
  roots: ClusterTreeNode[],
  allLinkIds: string[]
): ClusterTreeNode[] {
  const allowed = new Set(allLinkIds);
  const claimed = new Set<string>();

  function claim(ids: string[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
      if (!allowed.has(id) || claimed.has(id)) continue;
      claimed.add(id);
      out.push(id);
    }
    return out;
  }

  function softIds(node: ClusterTreeNode): string[] {
    return [
      ...node.linkIds.filter((id) => allowed.has(id)),
      ...node.children.flatMap(softIds),
    ];
  }

  function build(node: ClusterTreeNode): ClusterTreeNode | null {
    const children: ClusterTreeNode[] = [];
    const spill: string[] = [];

    for (const child of node.children) {
      const built = build(child);
      if (!built) {
        spill.push(...softIds(child));
        continue;
      }
      const total = countClusterLinks(built);
      if (built.name && total < MIN_CLUSTER_SIZE) {
        for (const id of flattenLinkIds(built)) claimed.delete(id);
        spill.push(...flattenLinkIds(built));
      } else {
        children.push(built);
      }
    }

    for (const id of spill) claimed.delete(id);
    const linkIds = claim([...node.linkIds, ...spill]);
    const next: ClusterTreeNode = {
      name: node.name?.trim() ? node.name.trim() : null,
      linkIds,
      children,
    };

    const total = countClusterLinks(next);
    if (total === 0) return null;

    if (next.name && total < MIN_CLUSTER_SIZE) {
      for (const id of flattenLinkIds(next)) claimed.delete(id);
      return null;
    }

    return next;
  }

  const out: ClusterTreeNode[] = [];
  const dissolved: string[] = [];

  for (const root of roots) {
    const built = build(root);
    if (!built) {
      dissolved.push(...softIds(root));
      continue;
    }
    out.push(built);
  }

  for (const id of dissolved) claimed.delete(id);
  const missing = allLinkIds.filter((id) => !claimed.has(id));
  const unnamedIds = claim(missing);

  if (unnamedIds.length > 0) {
    const existing = out.find((n) => n.name == null);
    if (existing) {
      existing.linkIds.push(...unnamedIds);
    } else {
      out.push({ name: null, linkIds: unnamedIds, children: [] });
    }
  }

  return out.filter((n) => countClusterLinks(n) > 0);
}

/** Layout positions for siblings in a grid. */
export function packClusterPositions(
  count: number,
  origin = { x: 0, y: 0 }
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: origin.x, y: origin.y }];

  const cols = Math.ceil(Math.sqrt(count));
  const gapX = 320;
  const gapY = 220;
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const width = Math.min(count - row * cols, cols);
    const rowOffset = ((cols - width) * gapX) / 2;
    positions.push({
      x: origin.x + col * gapX + rowOffset - ((cols - 1) * gapX) / 2,
      y: origin.y + row * gapY - (Math.ceil(count / cols) - 1) * (gapY / 2),
    });
  }
  return positions;
}

export function displayClusterName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unnamed";
}
