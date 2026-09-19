import type { Cluster } from "@/lib/clusters/types";
import type { LinkWithTags } from "@/lib/types";

export function getChildClusters(
  clusters: Cluster[],
  parentId: string | null
): Cluster[] {
  return clusters.filter((c) => c.parent_id === parentId);
}

export function getLinksInCluster(
  links: LinkWithTags[],
  clusterId: string
): LinkWithTags[] {
  return links.filter(
    (link) => !link.archived_at && link.cluster_id === clusterId
  );
}

/** Direct children + descendant link count for a cluster. */
export function clusterStats(
  clusters: Cluster[],
  links: LinkWithTags[],
  clusterId: string
): { childClusterCount: number; linkCount: number; previewLinks: LinkWithTags[] } {
  const children = getChildClusters(clusters, clusterId);
  let linkCount = 0;
  const preview: LinkWithTags[] = [];

  function walk(id: string) {
    const direct = getLinksInCluster(links, id);
    linkCount += direct.length;
    for (const link of direct) {
      if (preview.length < 4) preview.push(link);
    }
    for (const child of getChildClusters(clusters, id)) {
      walk(child.id);
    }
  }

  walk(clusterId);

  return {
    childClusterCount: children.length,
    linkCount,
    previewLinks: preview,
  };
}

export function clusterPath(
  clusters: Cluster[],
  clusterId: string | null
): Cluster[] {
  if (!clusterId) return [];
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const path: Cluster[] = [];
  let current = byId.get(clusterId) ?? null;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? (byId.get(current.parent_id) ?? null) : null;
  }
  return path;
}

/** Cluster that directly contains the link, then ancestors to root. */
export function pathToLink(
  clusters: Cluster[],
  link: LinkWithTags
): Cluster[] {
  if (!link.cluster_id) return [];
  return clusterPath(clusters, link.cluster_id);
}

export function unclusteredLinks(links: LinkWithTags[]): LinkWithTags[] {
  return links.filter((link) => !link.archived_at && !link.cluster_id);
}
