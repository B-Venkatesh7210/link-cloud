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
import { findLinkByUrl } from "@/lib/normalize-url";
import type { LinkWithTags } from "@/lib/types";

type AppStateContextValue = {
  links: LinkWithTags[];
  setLinks: (links: LinkWithTags[] | ((prev: LinkWithTags[]) => LinkWithTags[])) => void;
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
  searchInputRef: RefObject<HTMLInputElement | null> | null;
  registerSearchInput: (ref: RefObject<HTMLInputElement | null>) => void;
  allTagNames: string[];
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  initialLinks,
  children,
}: {
  initialLinks: LinkWithTags[];
  children: ReactNode;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [addLinkInitialUrl, setAddLinkInitialUrl] = useState("");
  const [editingLink, setEditingLink] = useState<LinkWithTags | null>(null);
  const [searchInputRef, setSearchInputRef] =
    useState<RefObject<HTMLInputElement | null> | null>(null);

  const revealLinkOnCanvas = useCallback(
    (link: LinkWithTags) => {
      // #region agent log
      fetch("http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ddc618",
        },
        body: JSON.stringify({
          sessionId: "ddc618",
          runId: "pre-fix",
          hypothesisId: "B",
          location: "app-state.tsx:revealLinkOnCanvas",
          message: "revealLinkOnCanvas called",
          data: {
            linkId: link.id,
            archived: Boolean(link.archived_at),
            labelLen: link.label.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setIsAddLinkOpen(false);
      setAddLinkInitialUrl("");
      setEditingLink(null);
      setSelectedLinkId(link.id);
      const query = link.label.trim() || link.hostname || link.url;
      setSearchQuery(query);
      window.setTimeout(() => {
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
      }, 30);
    },
    [searchInputRef]
  );

  const openAddLink = useCallback(
    (initialUrl = "") => {
      const trimmed = initialUrl.trim();
      // #region agent log
      fetch("http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ddc618",
        },
        body: JSON.stringify({
          sessionId: "ddc618",
          runId: "pre-fix",
          hypothesisId: "B",
          location: "app-state.tsx:openAddLink",
          message: "openAddLink called",
          data: {
            hasUrl: Boolean(trimmed),
            urlLen: trimmed.length,
            linkCount: links.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (trimmed) {
        const existing = findLinkByUrl(links, trimmed);
        if (existing) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "ddc618",
              },
              body: JSON.stringify({
                sessionId: "ddc618",
                runId: "pre-fix",
                hypothesisId: "B",
                location: "app-state.tsx:openAddLink:duplicate",
                message: "duplicate detected — revealing",
                data: { existingId: existing.id },
                timestamp: Date.now(),
              }),
            }
          ).catch(() => {});
          // #endregion
          revealLinkOnCanvas(existing);
          // Defer toast so it never runs inside another component's render/update.
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
    },
    [links]
  );

  const closeEditLink = useCallback(() => {
    setEditingLink(null);
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
      searchInputRef,
      registerSearchInput,
      allTagNames,
    }),
    [
      links,
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
