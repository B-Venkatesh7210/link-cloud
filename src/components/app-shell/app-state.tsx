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

  const openAddLink = useCallback((initialUrl = "") => {
    setEditingLink(null);
    setAddLinkInitialUrl(initialUrl);
    setIsAddLinkOpen(true);
  }, []);

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
