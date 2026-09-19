"use server";

import { revalidatePath } from "next/cache";
import { APP_ROUTES } from "@/config/app";
import { GROQ_CLUSTER_MODEL } from "@/lib/clusters/constants";
import { clusterifyWithGroq, hasGroqKey } from "@/lib/clusters/groq";
import { buildHeuristicTree } from "@/lib/clusters/heuristic";
import {
  normalizeClusterTree,
  packClusterPositions,
} from "@/lib/clusters/normalize";
import { getClustersForCurrentUser } from "@/lib/clusters/queries";
import type { Cluster, ClusterTreeNode } from "@/lib/clusters/types";
import { getLinksForCurrentUser } from "@/lib/links/queries";
import { takeRateLimitToken } from "@/lib/metadata/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, LinkWithTags } from "@/lib/types";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

async function insertTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  nodes: ClusterTreeNode[],
  parentId: string | null
): Promise<
  Array<{
    linkId: string;
    clusterId: string;
    cluster_x: number;
    cluster_y: number;
  }>
> {
  const assignments: Array<{
    linkId: string;
    clusterId: string;
    cluster_x: number;
    cluster_y: number;
  }> = [];

  const positions = packClusterPositions(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const pos = positions[i] ?? { x: 0, y: 0 };
    const { data: cluster, error } = await supabase
      .from("clusters")
      .insert({
        user_id: userId,
        parent_id: parentId,
        name: node.name,
        position_x: pos.x,
        position_y: pos.y,
        is_ai: true,
      })
      .select("*")
      .single();

    if (error || !cluster) {
      throw new Error(error?.message ?? "Failed to create cluster");
    }

    const linkPositions = packClusterPositions(node.linkIds.length, {
      x: 0,
      y: 80,
    });
    node.linkIds.forEach((linkId, index) => {
      const lp = linkPositions[index] ?? { x: 0, y: 0 };
      assignments.push({
        linkId,
        clusterId: cluster.id as string,
        cluster_x: lp.x,
        cluster_y: lp.y,
      });
    });

    if (node.children.length > 0) {
      const childAssignments = await insertTree(
        supabase,
        userId,
        node.children,
        cluster.id as string
      );
      assignments.push(...childAssignments);
    }
  }

  return assignments;
}

export async function clusterifyAction(): Promise<
  ActionResult<{
    clusters: Cluster[];
    links: LinkWithTags[];
    source: "groq" | "heuristic";
    model?: string;
  }>
> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const limited = takeRateLimitToken(`clusterify:${userId}`, 3, 60_000);
  if (!limited.ok) {
    return {
      success: false,
      error: "Clusterify is cooling down — try again in a minute.",
      code: "UNKNOWN",
    };
  }

  const links = await getLinksForCurrentUser({ includeArchived: false });
  if (links.length === 0) {
    return {
      success: false,
      error: "Add some links before clustering.",
      code: "VALIDATION",
    };
  }

  const inputs = links.map((link) => ({
    id: link.id,
    label: link.label,
    hostname: link.hostname,
    tags: link.tags.map((t) => t.name),
  }));

  let tree: ClusterTreeNode[];
  let source: "groq" | "heuristic" = "heuristic";
  let model: string | undefined;

  if (hasGroqKey() && links.length <= 120) {
    try {
      tree = await clusterifyWithGroq(inputs);
      source = "groq";
      model = GROQ_CLUSTER_MODEL;
    } catch {
      tree = buildHeuristicTree(inputs);
      source = "heuristic";
    }
  } else if (hasGroqKey() && links.length > 120) {
    // Large skies: hostname/tag grouping first (reliable under free-tier limits)
    tree = buildHeuristicTree(inputs);
    source = "heuristic";
  } else {
    tree = buildHeuristicTree(inputs);
  }

  const normalized = normalizeClusterTree(
    tree,
    links.map((l) => l.id)
  );

  // Clear existing clusters (links.cluster_id set null via ON DELETE SET NULL)
  const { error: deleteError } = await supabase
    .from("clusters")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return {
      success: false,
      error: "Couldn't reset previous clusters.",
      code: "UNKNOWN",
    };
  }

  let assignments: Array<{
    linkId: string;
    clusterId: string;
    cluster_x: number;
    cluster_y: number;
  }> = [];

  try {
    assignments = await insertTree(supabase, userId, normalized, null);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Couldn't save clusters.",
      code: "UNKNOWN",
    };
  }

  // Batch update links
  for (const item of assignments) {
    const { error } = await supabase
      .from("links")
      .update({
        cluster_id: item.clusterId,
        cluster_x: item.cluster_x,
        cluster_y: item.cluster_y,
        cluster_placement: "ai",
      })
      .eq("id", item.linkId)
      .eq("user_id", userId);

    if (error) {
      return {
        success: false,
        error: "Clusters saved but some link assignments failed.",
        code: "UNKNOWN",
      };
    }
  }

  const [clusters, refreshedLinks] = await Promise.all([
    getClustersForCurrentUser(),
    getLinksForCurrentUser({ includeArchived: false }),
  ]);

  revalidatePath(APP_ROUTES.app);

  return {
    success: true,
    data: {
      clusters,
      links: refreshedLinks,
      source,
      model,
    },
  };
}

export async function createClusterAction(input: {
  name?: string | null;
  parentId?: string | null;
}): Promise<ActionResult<Cluster>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const name = input.name?.trim() ? input.name.trim() : null;
  const siblings = (await getClustersForCurrentUser()).filter(
    (c) => c.parent_id === (input.parentId ?? null)
  );
  const pos = packClusterPositions(siblings.length + 1)[siblings.length] ?? {
    x: 0,
    y: 0,
  };

  const { data, error } = await supabase
    .from("clusters")
    .insert({
      user_id: userId,
      parent_id: input.parentId ?? null,
      name,
      position_x: pos.x,
      position_y: pos.y,
      is_ai: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "Couldn't create cluster.",
      code: "UNKNOWN",
    };
  }

  revalidatePath(APP_ROUTES.app);
  return { success: true, data: data as Cluster };
}

export async function renameClusterAction(
  clusterId: string,
  name: string | null
): Promise<ActionResult<Cluster>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const trimmed = name?.trim() ? name.trim() : null;
  const { data, error } = await supabase
    .from("clusters")
    .update({ name: trimmed, is_ai: false })
    .eq("id", clusterId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "Couldn't rename cluster.",
      code: "NOT_FOUND",
    };
  }

  revalidatePath(APP_ROUTES.app);
  return { success: true, data: data as Cluster };
}

export async function deleteClusterAction(
  clusterId: string
): Promise<ActionResult<{ clusters: Cluster[]; links: LinkWithTags[] }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const { error } = await supabase
    .from("clusters")
    .delete()
    .eq("id", clusterId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't delete cluster.",
      code: "UNKNOWN",
    };
  }

  const [clusters, links] = await Promise.all([
    getClustersForCurrentUser(),
    getLinksForCurrentUser({ includeArchived: false }),
  ]);

  revalidatePath(APP_ROUTES.app);
  return { success: true, data: { clusters, links } };
}

export async function moveLinkToClusterAction(
  linkId: string,
  clusterId: string | null
): Promise<ActionResult<LinkWithTags>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  if (clusterId) {
    const { data: cluster } = await supabase
      .from("clusters")
      .select("id")
      .eq("id", clusterId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!cluster) {
      return {
        success: false,
        error: "Cluster not found.",
        code: "NOT_FOUND",
      };
    }
  }

  const siblings = clusterId
    ? (await getLinksForCurrentUser()).filter((l) => l.cluster_id === clusterId)
    : [];
  const pos = packClusterPositions(siblings.length + 1)[siblings.length] ?? {
    x: 0,
    y: 0,
  };

  const { error } = await supabase
    .from("links")
    .update({
      cluster_id: clusterId,
      cluster_x: pos.x,
      cluster_y: pos.y,
      cluster_placement: "user",
    })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't move link.",
      code: "UNKNOWN",
    };
  }

  const links = await getLinksForCurrentUser({ includeArchived: true });
  const link = links.find((item) => item.id === linkId);
  if (!link) {
    return {
      success: false,
      error: "Link not found.",
      code: "NOT_FOUND",
    };
  }

  revalidatePath(APP_ROUTES.app);
  return { success: true, data: link };
}

export async function updateClusterPositionAction(
  clusterId: string,
  position_x: number,
  position_y: number
): Promise<ActionResult> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const { error } = await supabase
    .from("clusters")
    .update({ position_x, position_y })
    .eq("id", clusterId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't save cluster position.",
      code: "UNKNOWN",
    };
  }

  return { success: true, data: undefined };
}

export async function updateLinkClusterPositionAction(
  linkId: string,
  cluster_x: number,
  cluster_y: number
): Promise<ActionResult> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return {
      success: false,
      error: "Please sign in to continue.",
      code: "UNAUTHORIZED",
    };
  }

  const { error } = await supabase
    .from("links")
    .update({
      cluster_x,
      cluster_y,
      cluster_placement: "user",
    })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't save position.",
      code: "UNKNOWN",
    };
  }

  return { success: true, data: undefined };
}
