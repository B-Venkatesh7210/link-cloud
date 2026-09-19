"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue, type MutableRefObject } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  useStore,
  applyNodeChanges,
  type Node,
  type OnNodeDrag,
  type OnNodesChange,
  type NodeTypes,
  type CoordinateExtent,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/app-shell/app-state";
import { CloudEmptyState } from "@/components/cloud/cloud-empty-state";
import { LinkDetailPanel } from "@/components/cloud/link-detail-panel";
import {
  BUBBLE_SOLID_ZOOM,
  UrlBubbleNode,
  type UrlBubbleFlowNode,
} from "@/components/cloud/url-bubble-node";
import { ViewportControls } from "@/components/cloud/viewport-controls";
import { ImportFileButton } from "@/components/links/import-file-button";
import { Button } from "@/components/ui/button";
import {
  BUBBLE_FOOTPRINT,
  cloudTranslateExtent,
  homeFocusPoint,
  homeLinkCapacity,
  searchStageCenter,
  toOccupiedBox,
} from "@/lib/cloud/layout";
import { CLOUD_DENSE_COUNT, CLOUD_MIN_ZOOM } from "@/lib/cloud/perf";
import {
  archiveLinkAction,
  recordLinkOpenAction,
  toggleFavoriteAction,
  updateLinkPositionAction,
} from "@/lib/links/actions";
import { presentLinks, topSearchMatch } from "@/lib/search/fuse";
import type { UrlBubbleNodeData } from "@/lib/cloud/types";
import type { LinkWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function useViewportSize() {
  const [size, setSize] = useState({ width: 1280, height: 800 });
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/** Keeps a readable home zoom — never fit-all on boot. Pan to discover more. */
function CameraController({
  layoutKey,
  searching,
  draggingRef,
  focusX,
  focusY,
  linkCount,
  homeCapacity,
}: {
  layoutKey: string;
  searching: boolean;
  draggingRef: MutableRefObject<boolean>;
  focusX: number;
  focusY: number;
  linkCount: number;
  homeCapacity: number;
}) {
  const { setCenter, fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const lastKeyRef = useRef<string | null>(null);
  const wasSearchingRef = useRef(searching);

  useEffect(() => {
    const exitedSearch = wasSearchingRef.current && !searching;
    wasSearchingRef.current = searching;

    if (!nodesInitialized || searching || draggingRef.current || !layoutKey) {
      return;
    }

    const keyChanged = lastKeyRef.current !== layoutKey;
    if (!keyChanged && !exitedSearch) return;
    lastKeyRef.current = layoutKey;

    const id = window.setTimeout(() => {
      // Small skies can gently frame everything; large skies stay at home zoom.
      if (linkCount > 0 && linkCount <= homeCapacity) {
        void fitView({
          padding: 0.28,
          duration: 380,
          maxZoom: 1,
          minZoom: 0.85,
        });
        return;
      }

      void setCenter(focusX, focusY, {
        zoom: 1,
        duration: 380,
      });
    }, 50);

    return () => window.clearTimeout(id);
  }, [
    draggingRef,
    fitView,
    focusX,
    focusY,
    homeCapacity,
    layoutKey,
    linkCount,
    nodesInitialized,
    searching,
    setCenter,
  ]);

  return null;
}

/** Softens or disables the edge veil when zoomed out / dense (backdrop-filter is costly). */
function EdgeVeil({ dense }: { dense: boolean }) {
  const soft = useStore(
    (state) => state.transform[2] < BUBBLE_SOLID_ZOOM || dense
  );

  return (
    <div
      className={cn(
        "linkcloud-edge-veil",
        soft && "linkcloud-edge-veil--soft"
      )}
      aria-hidden
    />
  );
}

/** Centers the viewport on the #1 search hit so it reads as the main stage. */
function SearchFocusCamera({
  searching,
  queryKey,
  hasMatch,
  mobile,
}: {
  searching: boolean;
  queryKey: string;
  hasMatch: boolean;
  mobile: boolean;
}) {
  const { setCenter } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const lastFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodesInitialized || !searching || !hasMatch) {
      lastFocusRef.current = null;
      return;
    }

    const focusKey = queryKey;
    if (lastFocusRef.current === focusKey) return;
    lastFocusRef.current = focusKey;

    const id = window.setTimeout(() => {
      const stage = searchStageCenter({ mobile });
      void setCenter(stage.x, stage.y, {
        zoom: mobile ? 0.92 : 1,
        duration: 420,
      });
    }, 60);

    return () => window.clearTimeout(id);
  }, [hasMatch, mobile, nodesInitialized, queryKey, searching, setCenter]);

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
    openImportQueue,
    selectedLinkId,
    setSelectedLinkId,
  } = useAppState();

  const isMobile = useIsNarrow(639);
  const viewportSize = useViewportSize();
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
  // Under load, keep the previous layout on screen while search/present catches up.
  const deferredPresented = useDeferredValue(presented);

  const searching = Boolean(deferredQuery.trim());
  const matchedCount = deferredPresented.filter(
    (p) => p.matched && searching
  ).length;
  const dense = activeLinks.length >= CLOUD_DENSE_COUNT;
  const selectedLink =
    activeLinks.find((link) => link.id === selectedLinkId) ?? null;

  const layoutKey = useMemo(
    () =>
      activeLinks
        .map((link) => link.id)
        .sort()
        .join("|"),
    [activeLinks]
  );

  const occupiedBoxes = useMemo(
    () =>
      activeLinks.map((link) =>
        toOccupiedBox(
          { x: link.position_x, y: link.position_y },
          BUBBLE_FOOTPRINT.medium
        )
      ),
    [activeLinks]
  );

  const translateExtent = useMemo<CoordinateExtent>(() => {
    const base = cloudTranslateExtent(occupiedBoxes);
    if (!searching) return base;
    // Search stage lives around the origin — open the clamp so we can center it.
    return [
      [Math.min(base[0][0], -1100), Math.min(base[0][1], -800)],
      [Math.max(base[1][0], 1100), Math.max(base[1][1], 800)],
    ];
  }, [occupiedBoxes, searching]);

  const homeCapacity = useMemo(
    () => homeLinkCapacity(viewportSize),
    [viewportSize]
  );

  const homeFocus = useMemo(
    () => homeFocusPoint(activeLinks, homeCapacity),
    [activeLinks, homeCapacity]
  );

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
      let snapshot: LinkWithTags | undefined;

      setLinks((prev) => {
        const link = prev.find((item) => item.id === id);
        if (!link) return prev;
        snapshot = link;
        return prev.map((item) =>
          item.id === id
            ? {
                ...item,
                open_count: link.open_count + 1,
                last_opened_at: new Date().toISOString(),
              }
            : item
        );
      });

      if (!snapshot) return;

      const previousCount = snapshot.open_count;
      const previousOpened = snapshot.last_opened_at;
      window.open(snapshot.url, "_blank", "noopener,noreferrer");

      void recordLinkOpenAction(id).then((result) => {
        if (!result.success) {
          setLinks((latest) =>
            latest.map((item) =>
              item.id === id
                ? {
                    ...item,
                    open_count: previousCount,
                    last_opened_at: previousOpened,
                  }
                : item
            )
          );
        }
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
      !dense && (searching || wasSearchingRef.current);
    wasSearchingRef.current = searching;

    setNodes(() => {
      return deferredPresented.map((item) => {
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
          dense,
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
  }, [deferredPresented, searching, selectedLinkId, isMobile, canDrag, dense]);

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

      const position_x = Math.round(node.position.x * 100) / 100;
      const position_y = Math.round(node.position.y * 100) / 100;

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
        panOnScrollSpeed={0.85}
        zoomOnScroll={false}
        zoomActivationKeyCode={["Meta", "Control"]}
        zoomOnPinch
        panOnDrag
        selectionOnDrag={false}
        minZoom={CLOUD_MIN_ZOOM}
        maxZoom={2.2}
        translateExtent={translateExtent}
        proOptions={{ hideAttribution: true }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        className="linkcloud-flow bg-transparent!"
        onlyRenderVisibleElements
        elevateNodesOnSelect={false}
        nodesFocusable={false}
      >
        <CameraController
          layoutKey={layoutKey}
          searching={searching}
          draggingRef={draggingRef}
          focusX={homeFocus.x}
          focusY={homeFocus.y}
          linkCount={activeLinks.length}
          homeCapacity={homeCapacity}
        />
        <SearchFocusCamera
          searching={searching}
          queryKey={deferredQuery.trim()}
          hasMatch={matchedCount > 0}
          mobile={isMobile}
        />
        {activeLinks.length > 0 ? <ViewportControls homeFocus={homeFocus} /> : null}
      </ReactFlow>

      <EdgeVeil dense={dense} />

      {activeLinks.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="pointer-events-auto flex flex-col items-center">
            <CloudEmptyState />
            <div className="mt-8 flex items-center gap-3">
              <ImportFileButton
                links={links}
                onQueue={openImportQueue}
                variant="outline"
                className="h-12 min-w-[7.5rem] rounded-full border-0 bg-white px-6 text-[15px] font-medium text-slate-700 shadow-[0_8px_28px_rgba(70,120,180,0.14)] hover:bg-white hover:text-slate-900"
                label="Import"
              />
              <Button
                type="button"
                size="icon-lg"
                onClick={() => openAddLink()}
                className="size-12 shrink-0 rounded-full bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] hover:bg-slate-800"
                aria-label="Add link"
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-2 sm:right-6 sm:bottom-6">
          <ImportFileButton
            links={links}
            onQueue={openImportQueue}
            variant="outline"
            className="pointer-events-auto h-12 rounded-full border-0 bg-white/90 px-5 text-slate-600 shadow-[0_8px_24px_rgba(70,120,180,0.12)] backdrop-blur-md hover:bg-white"
            label="Import"
          />
          <Button
            type="button"
            size="icon-lg"
            onClick={() => openAddLink()}
            className="pointer-events-auto size-12 shrink-0 rounded-full bg-slate-900 text-white shadow-lg shadow-sky-900/15 hover:bg-slate-800"
            aria-label="Add link"
          >
            <Plus className="size-5" />
          </Button>
        </div>
      )}

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
