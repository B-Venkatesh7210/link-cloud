export type Cluster = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string | null;
  position_x: number;
  position_y: number;
  is_ai: boolean;
  created_at: string;
  updated_at: string;
};

export type ClusterPlacement = "ai" | "user";

/** Proposed tree from AI / heuristics before DB insert. */
export type ClusterTreeNode = {
  name: string | null;
  linkIds: string[];
  children: ClusterTreeNode[];
};

export type ClusterifyResult = {
  clusters: Cluster[];
  linkAssignments: Array<{
    linkId: string;
    clusterId: string;
    cluster_x: number;
    cluster_y: number;
    placement: ClusterPlacement;
  }>;
  source: "groq" | "heuristic";
  model?: string;
};
