"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "@/components/app-shell/app-state";
import { isValidHttpUrl } from "@/lib/normalize-url";

function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("\n") || trimmed.length > 2048) return false;
  if (/\s/.test(trimmed) && !trimmed.includes("://")) return false;
  return isValidHttpUrl(trimmed);
}

export function GlobalShortcuts() {
  const {
    openAddLink,
    searchInputRef,
    searchQuery,
    setSearchQuery,
    closeAddLink,
    closeEditLink,
    isAddLinkOpen,
    editingLink,
    selectedLinkId,
    setSelectedLinkId,
  } = useAppState();
  const lastPasteRef = useRef(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef?.current?.focus();
        searchInputRef?.current?.select();
        return;
      }

      if (event.key === "Escape") {
        if (editingLink) {
          closeEditLink();
          return;
        }
        if (isAddLinkOpen) {
          closeAddLink();
          return;
        }
        if (searchQuery.trim()) {
          setSearchQuery("");
          return;
        }
        if (selectedLinkId) {
          setSelectedLinkId(null);
          return;
        }
        if (document.activeElement === searchInputRef?.current) {
          searchInputRef.current?.blur();
        }
      }
    }

    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping || isAddLinkOpen || editingLink) return;

      const text = event.clipboardData?.getData("text")?.trim() ?? "";
      if (!looksLikeUrl(text)) return;

      const now = Date.now();
      if (now - lastPasteRef.current < 400) return;
      lastPasteRef.current = now;

      event.preventDefault();
      openAddLink(text);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    closeAddLink,
    closeEditLink,
    editingLink,
    isAddLinkOpen,
    openAddLink,
    searchInputRef,
    searchQuery,
    selectedLinkId,
    setSearchQuery,
    setSelectedLinkId,
  ]);

  return null;
}
