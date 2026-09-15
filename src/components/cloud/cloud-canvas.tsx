"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type OnNodeDrag,
  type OnNodesChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/app-shell/app-state";
import { CloudEmptyState } from "@/components/cloud/cloud-empty-state";
import { LinkDetailPanel } from "@/components/cloud/link-detail-panel";
import {
  UrlBubbleNode,
  type UrlBubbleFlowNode,
} from "@/components/cloud/url-bubble-node";
import { ViewportControls } from "@/components/cloud/viewport-controls";
import { Button } from "@/components/ui/button";
import {
  archiveLinkAction,
  recordLinkOpenAction,
  toggleFavoriteAction,
  updateLinkPositionAction,
} from "@/lib/links/actions";
import { presentLinks, topSearchMatch } from "@/lib/search/fuse";
import type { UrlBubbleNodeData } from "@/lib/cloud/types";
import type { LinkWithTags } from "@/lib/types";

const nodeTypes: NodeTypes = {
  urlBubble: UrlBubbleNode,
};

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

function CameraBootstrap({
  linkCount,
  searching,
}: {
  linkCount: number;
  searching: boolean;
}) {
  const { fitView, setViewport } = useReactFlow();
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current || searching || linkCount === 0) return;
    booted.current = true;

    const id = window.setTimeout(() => {
      if (linkCount <= 15) {
        fitView({ padding: 0.28, duration: 420, maxZoom: 1.05, minZoom: 0.55 });
      } else {
        setViewport({ x: 120, y: 80, zoom: 0.92 }, { duration: 360 });
      }
    }, 60);

    return () => window.clearTimeout(id);
  }, [fitView, linkCount, searching, setViewport]);

  return null;
}

function CloudCanvasInner() {
  const {
    links,
    setLinks,
    searchQuery,
    setSearchQuery,
    openAddLink,
    openEditLink,
    selectedLinkId,
    setSelectedLinkId,
  } = useAppState();

  const isMobile = useIsNarrow(639);
  const canDrag = !isMobile && !searchQuery.trim();
  const [nodes, setNodes] = useState<UrlBubbleFlowNode[]>([]);
  const [deferredQuery, setDeferredQuery] = useState(searchQuery);
  const dragOriginRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const draggingRef = useRef(false);
  const wasSearchingRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredQuery(searchQuery), 80);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const activeLinks = useMemo(
    () => links.filter((link) => !link.archived_at),
    [links]
  );

  const presented = useMemo(
    () => presentLinks(activeLinks, deferredQuery, { mobile: isMobile }),
    [activeLinks, deferredQuery, isMobile]
  );

  const searching = Boolean(deferredQuery.trim());
  const matchedCount = presented.filter((p) => p.matched && searching).length;
  const selectedLink =
    activeLinks.find((link) => link.id === selectedLinkId) ?? null;

  const updateLinkLocal = useCallback(
    (id: string, patch: Partial<LinkWithTags>) => {
      setLinks((prev) =>
        prev.map((link) => (link.id === id ? { ...link, ...patch } : link))
      );
    },
    [setLinks]
  );

  const handleOpen = useCallback(
    (id: string) => {
      setLinks((prev) => {
        const link = prev.find((item) => item.id === id);
        if (!link) return prev;

        window.open(link.url, "_blank", "noopener,noreferrer");

        const nextCount = link.open_count + 1;
        const nextOpened = new Date().toISOString();

        void recordLinkOpenAction(id).then((result) => {
          if (!result.success) {
            setLinks((latest) =>
              latest.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      open_count: link.open_count,
                      last_opened_at: link.last_opened_at,
                    }
                  : item
              )
            );
          }
        });

        return prev.map((item) =>
          item.id === id
            ? {
                ...item,
                open_count: nextCount,
                last_opened_at: nextOpened,
              }
            : item
        );
      });
    },
    [setLinks]
  );

  const handleCopy = useCallback(
    async (id: string) => {
      const link = links.find((item) => item.id === id);
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.url);
        toast.success("URL copied");
      } catch {
        toast.error("Couldn't copy the URL.");
      }
    },
    [links]
  );

  const handleToggleFavorite = useCallback(
    (id: string, next: boolean) => {
      let previous = false;
      setLinks((prev) => {
        previous = prev.find((item) => item.id === id)?.is_favorite ?? false;
        return prev.map((link) =>
          link.id === id ? { ...link, is_favorite: next } : link
        );
      });
      void toggleFavoriteAction(id, next).then((result) => {
        if (!result.success) {
          setLinks((prev) =>
            prev.map((link) =>
              link.id === id ? { ...link, is_favorite: previous } : link
            )
          );
          toast.error(result.error);
        }
      });
    },
    [setLinks]
  );

  const handleArchive = useCallback(
    (id: string) => {
      let snapshot: LinkWithTags[] = [];
      setLinks((prev) => {
        snapshot = prev;
        return prev.map((link) =>
          link.id === id
            ? { ...link, archived_at: new Date().toISOString() }
            : link
        );
      });
      if (selectedLinkId === id) setSelectedLinkId(null);
      void archiveLinkAction(id).then((result) => {
        if (!result.success) {
          setLinks(snapshot);
          toast.error(result.error);
        } else {
          toast.message("Link archived");
        }
      });
    },
    [selectedLinkId, setLinks, setSelectedLinkId]
  );

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedLinkId(id);
    },
    [setSelectedLinkId]
  );

  const handlersRef = useRef({
    handleSelect,
    handleOpen,
    handleToggleFavorite,
    handleCopy,
    handleArchive,
    openEditLink,
  });

  useEffect(() => {
    handlersRef.current = {
      handleSelect,
      handleOpen,
      handleToggleFavorite,
      handleCopy,
      handleArchive,
      openEditLink,
    };
  }, [
    handleSelect,
    handleOpen,
    handleToggleFavorite,
    handleCopy,
    handleArchive,
    openEditLink,
  ]);

  useEffect(() => {
    if (draggingRef.current) return;

    const shouldAnimatePositions =
      searching || wasSearchingRef.current;
    wasSearchingRef.current = searching;

    setNodes(() => {
      return presented.map((item) => {
        const data: UrlBubbleNodeData = {
          link: item,
          scale: item.scale,
          opacity: item.opacity,
          searching,
          matched: item.matched,
          searchRank: item.searchRank,
          selected: selectedLinkId === item.id,
          isMobile,
          recentEmphasis: item.recentEmphasis,
          onSelect: (id) => handlersRef.current.handleSelect(id),
          onOpen: (id) => handlersRef.current.handleOpen(id),
          onToggleFavorite: (id, next) =>
            handlersRef.current.handleToggleFavorite(id, next),
          onCopy: (id) => handlersRef.current.handleCopy(id),
          onEdit: (id) => handlersRef.current.openEditLink(id),
          onArchive: (id) => handlersRef.current.handleArchive(id),
        };

        return {
          id: item.id,
          type: "urlBubble" as const,
          position: { x: item.displayX, y: item.displayY },
          data,
          draggable: canDrag,
          selectable: true,
          selected: selectedLinkId === item.id,
          style: {
            transition: shouldAnimatePositions
              ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
              : undefined,
            zIndex:
              item.matched && searching
                ? 1000 - item.searchRank
                : item.is_favorite
                  ? 20
                  : 1,
          },
        } satisfies UrlBubbleFlowNode;
      });
    });
  }, [presented, searching, selectedLinkId, isMobile, canDrag]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current) as UrlBubbleFlowNode[]);
  }, []);

  const onNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    draggingRef.current = true;
    dragOriginRef.current.set(node.id, { ...node.position });
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      draggingRef.current = false;
      if (searching) return;
      const origin = dragOriginRef.current.get(node.id);
      dragOriginRef.current.delete(node.id);

      const position_x = node.position.x;
      const position_y = node.position.y;

      updateLinkLocal(node.id, { position_x, position_y });

      void updateLinkPositionAction(node.id, position_x, position_y).then(
        (result) => {
          if (!result.success && origin) {
            updateLinkLocal(node.id, {
              position_x: origin.x,
              position_y: origin.y,
            });
            setNodes((current) =>
              current.map((item) =>
                item.id === node.id
                  ? { ...item, position: { x: origin.x, y: origin.y } }
                  : item
              )
            );
            toast.error(result.error);
          }
        }
      );
    },
    [searching, updateLinkLocal]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (!isTyping) return;
      if (target?.id !== "global-search") return;

      const top = topSearchMatch(activeLinks, searchQuery);
      if (!top) return;
      event.preventDefault();
      handleOpen(top.id);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLinks, handleOpen, searchQuery]);

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onPaneClick={() => setSelectedLinkId(null)}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodesDraggable={canDrag}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        panOnDrag
        selectionOnDrag={false}
        minZoom={0.3}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        className="linkcloud-flow bg-transparent!"
        onlyRenderVisibleElements={activeLinks.length > 80}
      >
        <CameraBootstrap linkCount={activeLinks.length} searching={searching} />
        {activeLinks.length > 0 ? <ViewportControls /> : null}
      </ReactFlow>

      {activeLinks.length === 0 ? <CloudEmptyState /> : null}

      {searching && matchedCount === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-20 flex justify-center px-6">
          <div className="pointer-events-auto max-w-sm rounded-3xl bg-white/75 px-6 py-5 text-center shadow-[0_16px_40px_rgba(70,120,180,0.12)] ring-1 ring-white/80 backdrop-blur-xl">
            <p className="text-base font-medium text-slate-800">
              No link found for &ldquo;{searchQuery.trim()}&rdquo;.
            </p>
            <p className="mt-1 text-sm text-slate-500">Paste a URL to add it.</p>
            <Button
              type="button"
              className="mt-4 h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => {
                setSearchQuery("");
                openAddLink();
              }}
            >
              Add link
            </Button>
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

      <div className="pointer-events-none absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 sm:right-6 sm:bottom-6">
        <Button
          type="button"
          size="icon-lg"
          onClick={() => openAddLink()}
          className="pointer-events-auto size-12 rounded-2xl bg-slate-900 text-white shadow-lg shadow-sky-900/15 hover:bg-slate-800"
          aria-label="Add link"
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}

export function CloudCanvas() {
  return (
    <ReactFlowProvider>
      <CloudCanvasInner />
    </ReactFlowProvider>
  );
}
