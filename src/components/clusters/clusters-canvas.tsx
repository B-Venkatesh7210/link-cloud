"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  applyNodeChanges,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight, FolderPlus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/app-shell/app-state";
import {
  ClusterNode,
  type ClusterFlowNode,
} from "@/components/clusters/cluster-node";
import {
  UrlBubbleNode,
  type UrlBubbleFlowNode,
} from "@/components/cloud/url-bubble-node";
import { LinkDetailPanel } from "@/components/cloud/link-detail-panel";
import { Button } from "@/components/ui/button";
import {
  clusterifyAction,
  createClusterAction,
  moveLinkToClusterAction,
  renameClusterAction,
  updateClusterPositionAction,
  updateLinkClusterPositionAction,
} from "@/lib/clusters/actions";
import { CLUSTERS_MIN_ZOOM } from "@/lib/clusters/constants";
import { displayClusterName, packClusterPositions } from "@/lib/clusters/normalize";
import {
  clusterPath,
  clusterStats,
  getChildClusters,
  getLinksInCluster,
  pathToLink,
  unclusteredLinks,
} from "@/lib/clusters/tree";
import {
  archiveLinkAction,
  recordLinkOpenAction,
  toggleFavoriteAction,
} from "@/lib/links/actions";
import { topSearchMatch } from "@/lib/search/fuse";
import type { LinkWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

const nodeTypes: NodeTypes = {
  cluster: ClusterNode,
  urlBubble: UrlBubbleNode,
};

type AnyNode = ClusterFlowNode | UrlBubbleFlowNode;

function useIsNarrow(maxWidth = 639) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [maxWidth]);
  return narrow;
}

function FocusCamera({
  focusKey,
  x,
  y,
  zoom,
}: {
  focusKey: string;
  x: number;
  y: number;
  zoom: number;
}) {
  const { setCenter } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || !focusKey) return;
    if (lastKey.current === focusKey) return;
    lastKey.current = focusKey;
    const id = window.setTimeout(() => {
      void setCenter(x, y, { zoom, duration: 420 });
    }, 40);
    return () => window.clearTimeout(id);
  }, [focusKey, nodesInitialized, setCenter, x, y, zoom]);

  return null;
}

function ClustersCanvasInner() {
  const {
    links,
    setLinks,
    clusters,
    setClusters,
    focusClusterId,
    setFocusClusterId,
    searchQuery,
    selectedLinkId,
    setSelectedLinkId,
    openEditLink,
  } = useAppState();

  const isMobile = useIsNarrow();
  const [nodes, setNodes] = useState<AnyNode[]>([]);
  const [clusterifying, setClusterifying] = useState(false);
  const [relocatingId, setRelocatingId] = useState<string | null>(null);
  const [dwellClusterId, setDwellClusterId] = useState<string | null>(null);
  const longPressRef = useRef<{
    linkId: string;
    timer: number;
  } | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const activeLinks = useMemo(
    () => links.filter((link) => !link.archived_at),
    [links]
  );

  const childClusters = useMemo(
    () => getChildClusters(clusters, focusClusterId),
    [clusters, focusClusterId]
  );

  const interiorLinks = useMemo(() => {
    if (focusClusterId) {
      return getLinksInCluster(activeLinks, focusClusterId);
    }
    // Root overview: only show unclustered loose links (rare)
    return unclusteredLinks(activeLinks);
  }, [activeLinks, focusClusterId]);

  const breadcrumbs = useMemo(
    () => clusterPath(clusters, focusClusterId),
    [clusters, focusClusterId]
  );

  const selectedLink =
    activeLinks.find((link) => link.id === selectedLinkId) ?? null;

  const searching = Boolean(searchQuery.trim());
  const searchHit = useMemo(
    () => (searching ? topSearchMatch(activeLinks, searchQuery) : null),
    [activeLinks, searchQuery, searching]
  );

  // Search path: zoom into the link's cluster, then select
  const lastSearchFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!searchHit) {
      lastSearchFocus.current = null;
      return;
    }
    const token = `${searchQuery.trim()}::${searchHit.id}`;
    if (lastSearchFocus.current === token) return;
    lastSearchFocus.current = token;

    const path = pathToLink(clusters, searchHit);
    if (path.length === 0) {
      setFocusClusterId(null);
      setSelectedLinkId(searchHit.id);
      return;
    }
    let i = 0;
    let cancelled = false;
    setFocusClusterId(null);
    const step = () => {
      if (cancelled) return;
      if (i < path.length) {
        setFocusClusterId(path[i]!.id);
        i += 1;
        window.setTimeout(step, 380);
      } else {
        setSelectedLinkId(searchHit.id);
      }
    };
    const id = window.setTimeout(step, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [searchHit, searchQuery, clusters, setFocusClusterId, setSelectedLinkId]);

  const updateLinkLocal = useCallback(
    (id: string, patch: Partial<LinkWithTags>) => {
      setLinks((prev) =>
        prev.map((link) => (link.id === id ? { ...link, ...patch } : link))
      );
    },
    [setLinks]
  );

  const handleOpen = useCallback(
    async (id: string) => {
      const link = activeLinks.find((item) => item.id === id);
      if (!link) return;
      window.open(link.url, "_blank", "noopener,noreferrer");
      void recordLinkOpenAction(id).then((result) => {
        if (result.success) {
          updateLinkLocal(id, {
            open_count: result.data.open_count,
            last_opened_at: result.data.last_opened_at,
          });
        }
      });
    },
    [activeLinks, updateLinkLocal]
  );

  const handleToggleFavorite = useCallback(
    (id: string, next: boolean) => {
      updateLinkLocal(id, { is_favorite: next });
      void toggleFavoriteAction(id, next).then((result) => {
        if (!result.success) {
          updateLinkLocal(id, { is_favorite: !next });
          toast.error(result.error);
        }
      });
    },
    [updateLinkLocal]
  );

  const handleCopy = useCallback(
    async (id: string) => {
      const link = activeLinks.find((item) => item.id === id);
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.url);
        toast.success("URL copied");
      } catch {
        toast.error("Couldn't copy URL");
      }
    },
    [activeLinks]
  );

  const handleArchive = useCallback(
    (id: string) => {
      const snapshot = activeLinks.find((item) => item.id === id);
      setLinks((prev) =>
        prev.map((link) =>
          link.id === id
            ? { ...link, archived_at: new Date().toISOString() }
            : link
        )
      );
      setSelectedLinkId(null);
      void archiveLinkAction(id).then((result) => {
        if (!result.success && snapshot) {
          setLinks((prev) =>
            prev.map((link) => (link.id === id ? snapshot : link))
          );
          toast.error(result.error);
        } else {
          toast.message("Archived");
        }
      });
    },
    [activeLinks, setLinks, setSelectedLinkId]
  );

  const beginRelocate = useCallback(
    (linkId: string) => {
      setRelocatingId(linkId);
      setFocusClusterId(null);
      setSelectedLinkId(linkId);
      toast.message("Drop onto a cluster — hover to drill in");
    },
    [setFocusClusterId, setSelectedLinkId]
  );

  const cancelRelocate = useCallback(() => {
    setRelocatingId(null);
    setDwellClusterId(null);
    if (dwellTimerRef.current) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const commitMove = useCallback(
    async (clusterId: string | null) => {
      if (!relocatingId) return;
      const linkId = relocatingId;
      cancelRelocate();
      const result = await moveLinkToClusterAction(linkId, clusterId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setLinks((prev) =>
        prev.map((link) => (link.id === linkId ? result.data : link))
      );
      if (clusterId) setFocusClusterId(clusterId);
      toast.success("Moved");
    },
    [relocatingId, cancelRelocate, setLinks, setFocusClusterId]
  );

  const handlersRef = useRef({
    handleSelect: (id: string) => setSelectedLinkId(id),
    handleOpen,
    handleToggleFavorite,
    handleCopy,
    handleArchive,
    openEditLink,
    beginRelocate,
  });
  handlersRef.current = {
    handleSelect: (id: string) => setSelectedLinkId(id),
    handleOpen,
    handleToggleFavorite,
    handleCopy,
    handleArchive,
    openEditLink,
    beginRelocate,
  };

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (relocatingId) {
          cancelRelocate();
          return;
        }
        if (focusClusterId) {
          const path = clusterPath(clusters, focusClusterId);
          const parent = path.length > 1 ? path[path.length - 2]!.id : null;
          setFocusClusterId(parent);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    relocatingId,
    cancelRelocate,
    focusClusterId,
    clusters,
    setFocusClusterId,
  ]);

  useEffect(() => {
    const next: AnyNode[] = [];

    for (const cluster of childClusters) {
      const stats = clusterStats(clusters, activeLinks, cluster.id);
      next.push({
        id: `cluster:${cluster.id}`,
        type: "cluster",
        position: { x: cluster.position_x, y: cluster.position_y },
        data: {
          cluster,
          linkCount: stats.linkCount,
          childClusterCount: stats.childClusterCount,
          previewLinks: stats.previewLinks,
          dropTarget: dwellClusterId === cluster.id || relocatingId != null,
          onOpen: (id) => {
            if (relocatingId) {
              // Drill in while relocating
              setFocusClusterId(id);
              return;
            }
            setFocusClusterId(id);
            setSelectedLinkId(null);
          },
          onDropHere: relocatingId
            ? (id) => {
                void commitMove(id);
              }
            : undefined,
        },
        draggable: !relocatingId,
        selectable: true,
      } satisfies ClusterFlowNode);
    }

    // Pack links missing cluster coords
    const linkPositions = packClusterPositions(interiorLinks.length, {
      x: childClusters.length > 0 ? 0 : 0,
      y: childClusters.length > 0 ? 260 : 0,
    });

    interiorLinks.forEach((link, index) => {
      const fallback = linkPositions[index] ?? { x: 0, y: 0 };
      const x = link.cluster_x ?? fallback.x;
      const y = link.cluster_y ?? fallback.y;
      const matched = searchHit?.id === link.id;

      next.push({
        id: link.id,
        type: "urlBubble",
        position: { x, y },
        data: {
          link,
          scale: matched ? 1.05 : 0.92,
          opacity: searching && !matched ? 0.35 : 1,
          searching,
          matched: Boolean(matched),
          searchRank: matched ? 0 : 99,
          selected: selectedLinkId === link.id || relocatingId === link.id,
          isMobile,
          recentEmphasis: false,
          dense: true,
          onSelect: (id) => handlersRef.current.handleSelect(id),
          onOpen: (id) => handlersRef.current.handleOpen(id),
          onToggleFavorite: (id, nextFav) =>
            handlersRef.current.handleToggleFavorite(id, nextFav),
          onCopy: (id) => handlersRef.current.handleCopy(id),
          onEdit: (id) => handlersRef.current.openEditLink(id),
          onArchive: (id) => handlersRef.current.handleArchive(id),
        },
        draggable: !relocatingId,
        selectable: true,
        selected: selectedLinkId === link.id,
        style: {
          zIndex: matched ? 1000 : relocatingId === link.id ? 900 : 1,
        },
      } satisfies UrlBubbleFlowNode);
    });

    setNodes(next);
  }, [
    childClusters,
    clusters,
    activeLinks,
    interiorLinks,
    dwellClusterId,
    relocatingId,
    searchHit,
    searching,
    selectedLinkId,
    isMobile,
    commitMove,
    setFocusClusterId,
    setSelectedLinkId,
  ]);

  // Long-press handled by LongPressBridge
  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current) as AnyNode[]);
  }, []);

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    draggingRef.current = true;
    clearLongPress();
  }, [clearLongPress]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      draggingRef.current = false;
      const x = Math.round(node.position.x * 100) / 100;
      const y = Math.round(node.position.y * 100) / 100;

      if (node.type === "cluster") {
        const clusterId = String(node.id).replace(/^cluster:/, "");
        setClusters((prev) =>
          prev.map((c) =>
            c.id === clusterId ? { ...c, position_x: x, position_y: y } : c
          )
        );
        void updateClusterPositionAction(clusterId, x, y);
        return;
      }

      updateLinkLocal(node.id, { cluster_x: x, cluster_y: y });
      void updateLinkClusterPositionAction(node.id, x, y);
    },
    [setClusters, updateLinkLocal]
  );

  // Dwell while relocating: pointer over cluster zooms in
  const onNodeMouseEnter = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (!relocatingId || node.type !== "cluster") return;
      const clusterId = String(node.id).replace(/^cluster:/, "");
      setDwellClusterId(clusterId);
      if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = window.setTimeout(() => {
        setFocusClusterId(clusterId);
        setDwellClusterId(null);
      }, 450);
    },
    [relocatingId, setFocusClusterId]
  );

  const onNodeMouseLeave = useCallback(() => {
    setDwellClusterId(null);
    if (dwellTimerRef.current) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const runClusterify = useCallback(async () => {
    setClusterifying(true);
    const toastId = toast.loading("Clustering with AI…");
    try {
      const result = await clusterifyAction();
      if (!result.success) {
        toast.error(result.error, { id: toastId });
        return;
      }
      setClusters(result.data.clusters);
      setLinks(result.data.links);
      setFocusClusterId(null);
      cancelRelocate();
      toast.success(
        result.data.source === "groq"
          ? `Clustered with Groq (${result.data.model ?? "LLM"})`
          : "Clustered with hostname heuristics",
        { id: toastId }
      );
    } finally {
      setClusterifying(false);
    }
  }, [setClusters, setLinks, setFocusClusterId, cancelRelocate]);

  const createCluster = useCallback(async () => {
    const name = window.prompt("Cluster name (leave blank for Unnamed)");
    if (name === null) return;
    const result = await createClusterAction({
      name: name.trim() || null,
      parentId: focusClusterId,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setClusters((prev) => [...prev, result.data]);
    toast.success("Cluster created");
  }, [focusClusterId, setClusters]);

  const renameCurrent = useCallback(async () => {
    if (!focusClusterId) return;
    const current = clusters.find((c) => c.id === focusClusterId);
    const next = window.prompt(
      "Rename cluster",
      current?.name ?? ""
    );
    if (next === null) return;
    const result = await renameClusterAction(
      focusClusterId,
      next.trim() || null
    );
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setClusters((prev) =>
      prev.map((c) => (c.id === focusClusterId ? result.data : c))
    );
  }, [focusClusterId, clusters, setClusters]);

  const focusPoint = useMemo(() => {
    if (searchHit && selectedLinkId === searchHit.id) {
      const link = interiorLinks.find((l) => l.id === searchHit.id);
      if (link) {
        return {
          x: (link.cluster_x ?? 0) + 140,
          y: (link.cluster_y ?? 0) + 40,
          zoom: 1.05,
          key: `link:${link.id}:${focusClusterId}`,
        };
      }
    }
    if (childClusters.length === 0 && interiorLinks.length === 0) {
      return { x: 0, y: 0, zoom: 1, key: `empty:${focusClusterId}` };
    }
    return {
      x: 0,
      y: 40,
      zoom: focusClusterId ? 1 : 0.85,
      key: `level:${focusClusterId ?? "root"}:${childClusters.length}:${interiorLinks.length}`,
    };
  }, [
    searchHit,
    selectedLinkId,
    interiorLinks,
    childClusters.length,
    focusClusterId,
  ]);

  const empty = clusters.length === 0 && activeLinks.length > 0;

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onPaneClick={() => {
          if (relocatingId && focusClusterId) {
            void commitMove(focusClusterId);
            return;
          }
          setSelectedLinkId(null);
        }}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeClick={(_e, node) => {
          clearLongPress();
          if (node.type === "urlBubble") {
            setSelectedLinkId(node.id);
          }
        }}
        nodesDraggable={!relocatingId}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        zoomActivationKeyCode={["Meta", "Control"]}
        zoomOnPinch
        panOnDrag={!relocatingId}
        minZoom={CLUSTERS_MIN_ZOOM}
        maxZoom={2}
        onlyRenderVisibleElements
        elevateNodesOnSelect={false}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        className="linkcloud-flow bg-transparent!"
      >
        <FocusCamera
          focusKey={focusPoint.key}
          x={focusPoint.x}
          y={focusPoint.y}
          zoom={focusPoint.zoom}
        />
        <LongPressBridge
          relocatingId={relocatingId}
          beginRelocate={beginRelocate}
          clearLongPress={clearLongPress}
          longPressRef={longPressRef}
        />
      </ReactFlow>

      <div className="linkcloud-edge-veil linkcloud-edge-veil--soft" aria-hidden />

      {/* Breadcrumbs */}
      <div className="pointer-events-none absolute top-[max(7.5rem,calc(env(safe-area-inset-top)+6.5rem))] left-4 z-30 sm:left-5">
        <nav className="pointer-events-auto flex max-w-[min(90vw,28rem)] flex-wrap items-center gap-1 rounded-2xl bg-white/70 px-2.5 py-1.5 text-[12px] shadow-sm ring-1 ring-white/70 backdrop-blur-md">
          <button
            type="button"
            className="rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-white/80"
            onClick={() => setFocusClusterId(null)}
          >
            All
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-slate-400" />
              <button
                type="button"
                className="max-w-[8rem] truncate rounded-lg px-2 py-1 font-medium text-slate-700 hover:bg-white/80"
                onClick={() => setFocusClusterId(crumb.id)}
              >
                {displayClusterName(crumb.name)}
              </button>
            </span>
          ))}
          {focusClusterId ? (
            <button
              type="button"
              className="ml-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-white/80"
              onClick={() => void renameCurrent()}
            >
              Rename
            </button>
          ) : null}
        </nav>
      </div>

      {/* Actions */}
      <div className="pointer-events-none absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
        {relocatingId ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-900/90 px-3 py-2 text-white shadow-lg">
            <span className="text-[12px]">Moving link…</span>
            {focusClusterId ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-xl bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => void commitMove(focusClusterId)}
              >
                Drop here
              </Button>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Cancel move"
              onClick={cancelRelocate}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-0 bg-white/90 px-4 text-slate-700 shadow-[0_8px_24px_rgba(70,120,180,0.12)]"
            onClick={() => void createCluster()}
          >
            <FolderPlus className="size-4" />
            New cluster
          </Button>
          <Button
            type="button"
            disabled={clusterifying}
            className="h-11 rounded-full bg-slate-900 px-4 text-white shadow-lg hover:bg-slate-800"
            onClick={() => void runClusterify()}
          >
            <Sparkles className={cn("size-4", clusterifying && "animate-pulse")} />
            {clusterifying ? "Clustering…" : "Clusterify"}
          </Button>
        </div>
      </div>

      {empty ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="pointer-events-auto max-w-sm rounded-3xl bg-white/80 px-6 py-5 text-center shadow-[0_16px_40px_rgba(70,120,180,0.12)] ring-1 ring-white/80">
            <p className="text-base font-medium text-slate-800">
              No clusters yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Run Clusterify to group your links, or create a cluster manually.
            </p>
          </div>
        </div>
      ) : null}

      <LinkDetailPanel
        link={selectedLink}
        isMobile={isMobile}
        onClose={() => setSelectedLinkId(null)}
        onOpen={handleOpen}
        onCopy={handleCopy}
        onEdit={openEditLink}
        onToggleFavorite={handleToggleFavorite}
        onArchive={handleArchive}
      />
    </div>
  );
}

/** Captures long-press on url bubbles via document-level tracking of RF node DOM. */
function LongPressBridge({
  relocatingId,
  beginRelocate,
  clearLongPress,
  longPressRef,
}: {
  relocatingId: string | null;
  beginRelocate: (id: string) => void;
  clearLongPress: () => void;
  longPressRef: MutableRefObject<{ linkId: string; timer: number } | null>;
}) {
  useEffect(() => {
    function onDown(event: PointerEvent) {
      if (relocatingId) return;
      const target = event.target as HTMLElement | null;
      const nodeEl = target?.closest(".react-flow__node-urlBubble") as
        | HTMLElement
        | null;
      if (!nodeEl) return;
      const linkId = nodeEl.getAttribute("data-id");
      if (!linkId) return;
      if (longPressRef.current) {
        window.clearTimeout(longPressRef.current.timer);
      }
      longPressRef.current = {
        linkId,
        timer: window.setTimeout(() => {
          longPressRef.current = null;
          beginRelocate(linkId);
        }, 380),
      };
    }
    function onUp() {
      clearLongPress();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [relocatingId, beginRelocate, clearLongPress, longPressRef]);

  return null;
}

export function ClustersCanvas() {
  return (
    <ReactFlowProvider>
      <ClustersCanvasInner />
    </ReactFlowProvider>
  );
}
