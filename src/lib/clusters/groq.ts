import { GROQ_CLUSTER_MODEL, MIN_CLUSTER_SIZE } from "@/lib/clusters/constants";
import type { ClusterTreeNode } from "@/lib/clusters/types";

export type GroqLinkInput = {
  id: string;
  label: string;
  hostname: string;
  tags: string[];
};

type GroqClusterJson = {
  clusters?: Array<{
    name?: string | null;
    linkIds?: string[];
    children?: GroqClusterJson["clusters"];
  }>;
};

function mapNodes(
  nodes: GroqClusterJson["clusters"] | undefined
): ClusterTreeNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => ({
    name: node.name?.trim() ? node.name.trim() : null,
    linkIds: Array.isArray(node.linkIds)
      ? node.linkIds.filter((id): id is string => typeof id === "string")
      : [],
    children: mapNodes(node.children),
  }));
}

export async function clusterifyWithGroq(
  links: GroqLinkInput[]
): Promise<ClusterTreeNode[]> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const payload = links.map((link) => ({
    id: link.id,
    label: link.label.slice(0, 80),
    host: link.hostname.replace(/^www\./i, "").slice(0, 80),
    tags: link.tags.slice(0, 6),
  }));

  const system = `You organize bookmarks into nested topic clusters.
Return ONLY valid JSON of the form:
{"clusters":[{"name":"Topic","linkIds":["uuid",...],"children":[...]}]}

Rules:
- Use every link id exactly once across the whole tree.
- Named clusters need at least ${MIN_CLUSTER_SIZE} links total (including nested children).
- Put weak/miscellaneous links in a cluster with "name": null (Unnamed).
- Prefer 3–8 top-level clusters. Nest only when a group is clearly larger and has subgroups.
- Names: short Title Case (1–3 words). No emojis.`;

  const user = `Categorize these ${payload.length} links:\n${JSON.stringify(payload)}`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_CLUSTER_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Groq error ${response.status}: ${text.slice(0, 200) || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  let parsed: GroqClusterJson;
  try {
    parsed = JSON.parse(content) as GroqClusterJson;
  } catch {
    throw new Error("Groq returned invalid JSON");
  }

  return mapNodes(parsed.clusters);
}

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}
