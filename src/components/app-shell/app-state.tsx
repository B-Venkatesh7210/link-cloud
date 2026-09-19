"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import type { ImportDraft } from "@/lib/import/parse-links-file";
import { findLinkByUrl } from "@/lib/normalize-url";
import type { Cluster } from "@/lib/clusters/types";
import type { LinkWithTags } from "@/lib/types";

export type CanvasMode = "cloud" | "clusters";

type AppStateContextValue = {
  links: LinkWithTags[];
  setLinks: (links: LinkWithTags[] | ((prev: LinkWithTags[]) => LinkWithTags[])) => void;
  clusters: Cluster[];
  setClusters: (clusters: Cluster[] | ((prev: Cluster[]) => Cluster[])) => void;
  canvasMode: CanvasMode;
  setCanvasMode: (mode: CanvasMode) => void;
  focusClusterId: string | null;
  setFocusClusterId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLinkId: string | null;
  setSelectedLinkId: (id: string | null) => void;
  isAddLinkOpen: boolean;
  openAddLink: (initialUrl?: string) => void;
  closeAddLink: () => void;
  addLinkInitialUrl: string;
  editingLink: LinkWithTags | null;
  openEditLink: (id: string) => void;
  closeEditLink: () => void;
  /** Close dialogs, search for this link, and select it on the canvas. */
  revealLinkOnCanvas: (link: LinkWithTags) => void;
  importQueue: ImportDraft[];
  importIndex: number;
  isImportOpen: boolean;
  openImportQueue: (drafts: ImportDraft[]) => void;
  closeImportQueue: () => void;
  setImportIndex: (index: number) => void;
  updateImportDraft: (id: string, patch: Partial<ImportDraft>) => void;
  removeImportDraft: (id: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null> | null;
  registerSearchInput: (ref: RefObject<HTMLInputElement | null>) => void;
  allTagNames: string[];
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  initialLinks,
  initialClusters = [],
  children,
}: {
  initialLinks: LinkWithTags[];
  initialClusters?: Cluster[];
  children: ReactNode;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [clusters, setClusters] = useState(initialClusters);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("cloud");
  const [focusClusterId, setFocusClusterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [addLinkInitialUrl, setAddLinkInitialUrl] = useState("");
  const [editingLink, setEditingLink] = useState<LinkWithTags | null>(null);
  const [importQueue, setImportQueue] = useState<ImportDraft[]>([]);
  const [importIndex, setImportIndex] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchInputRef, setSearchInputRef] =
    useState<RefObject<HTMLInputElement | null> | null>(null);

  const revealLinkOnCanvas = useCallback(
    (link: LinkWithTags) => {
      setIsAddLinkOpen(false);
      setAddLinkInitialUrl("");
      setEditingLink(null);
      setIsImportOpen(false);
      setSelectedLinkId(link.id);
      if (canvasMode === "clusters" && link.cluster_id) {
        setFocusClusterId(link.cluster_id);
      }
      const query = link.label.trim() || link.hostname || link.url;
      setSearchQuery(query);
      window.setTimeout(() => {
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
      }, 30);
    },
    [canvasMode, searchInputRef]
  );

  const openAddLink = useCallback(
    (initialUrl = "") => {
      const trimmed = initialUrl.trim();
      if (trimmed) {
        const existing = findLinkByUrl(links, trimmed);
        if (existing) {
          revealLinkOnCanvas(existing);
          queueMicrotask(() => {
            toast.message(
              existing.archived_at
                ? "Already saved (archived) — showing that link"
                : "Already in your sky — showing that link"
            );
          });
          return;
        }
      }
      setEditingLink(null);
      setIsImportOpen(false);
      setAddLinkInitialUrl(initialUrl);
      setIsAddLinkOpen(true);
    },
    [links, revealLinkOnCanvas]
  );

  const closeAddLink = useCallback(() => {
    setIsAddLinkOpen(false);
    setAddLinkInitialUrl("");
  }, []);

  const openEditLink = useCallback(
    (id: string) => {
      const link = links.find((item) => item.id === id) ?? null;
      if (!link) return;
      setSelectedLinkId(id);
      setEditingLink(link);
      setIsAddLinkOpen(false);
      setIsImportOpen(false);
    },
    [links]
  );

  const closeEditLink = useCallback(() => {
    setEditingLink(null);
  }, []);

  const openImportQueue = useCallback((drafts: ImportDraft[]) => {
    if (drafts.length === 0) return;
    setIsAddLinkOpen(false);
    setEditingLink(null);
    setImportQueue(drafts);
    setImportIndex(0);
    setIsImportOpen(true);
  }, []);

  const closeImportQueue = useCallback(() => {
    setIsImportOpen(false);
    setImportQueue([]);
    setImportIndex(0);
  }, []);

  const updateImportDraft = useCallback(
    (id: string, patch: Partial<ImportDraft>) => {
      setImportQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const removeImportDraft = useCallback((id: string) => {
    setImportQueue((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setImportIndex((index) => {
        if (next.length === 0) return 0;
        return Math.min(index, next.length - 1);
      });
      return next;
    });
  }, []);

  const registerSearchInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>) => {
      setSearchInputRef(ref);
    },
    []
  );

  const allTagNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of links) {
      for (const tag of link.tags) {
        map.set(tag.normalized_name, tag.name);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [links]);

  const value = useMemo(
    () => ({
      links,
      setLinks,
      clusters,
      setClusters,
      canvasMode,
      setCanvasMode,
      focusClusterId,
      setFocusClusterId,
      searchQuery,
      setSearchQuery,
      selectedLinkId,
      setSelectedLinkId,
      isAddLinkOpen,
      openAddLink,
      closeAddLink,
      addLinkInitialUrl,
      editingLink,
      openEditLink,
      closeEditLink,
      revealLinkOnCanvas,
      importQueue,
      importIndex,
      isImportOpen,
      openImportQueue,
      closeImportQueue,
      setImportIndex,
      updateImportDraft,
      removeImportDraft,
      searchInputRef,
      registerSearchInput,
      allTagNames,
    }),
    [
      links,
      clusters,
      canvasMode,
      focusClusterId,
      searchQuery,
      selectedLinkId,
      isAddLinkOpen,
      openAddLink,
      closeAddLink,
      addLinkInitialUrl,
      editingLink,
      openEditLink,
      closeEditLink,
      revealLinkOnCanvas,
      importQueue,
      importIndex,
      isImportOpen,
      openImportQueue,
      closeImportQueue,
      updateImportDraft,
      removeImportDraft,
      searchInputRef,
      registerSearchInput,
      allTagNames,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
