"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useAppState } from "@/components/app-shell/app-state";
import { cn } from "@/lib/utils";
import { isStrongTopMatch, topSearchMatch } from "@/lib/search/fuse";

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function GlobalSearch() {
  const { searchQuery, setSearchQuery, registerSearchInput, links } =
    useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    registerSearchInput(inputRef);
  }, [registerSearchInput]);

  const shortcut = isMac() ? "⌘K" : "Ctrl K";
  const activeLinks = useMemo(
    () => links.filter((link) => !link.archived_at),
    [links]
  );
  const top = topSearchMatch(activeLinks, searchQuery);
  const showEnterHint = focused && isStrongTopMatch(top);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-14 sm:top-5 sm:px-24 pt-[env(safe-area-inset-top)]">
      <div className="pointer-events-auto w-full max-w-xl">
        <label className="sr-only" htmlFor="global-search">
          Find any link
        </label>
        <div
          className={cn(
            "group relative flex items-center gap-2 rounded-2xl bg-white/70 px-3 shadow-[0_8px_30px_rgba(56,120,180,0.12)] ring-1 ring-white/80 backdrop-blur-xl transition-[box-shadow,ring-color] duration-200",
            "focus-within:shadow-[0_10px_40px_rgba(56,120,180,0.18)] focus-within:ring-sky-300/80"
          )}
        >
          <Search
            className="size-4 shrink-0 text-slate-400 transition-colors group-focus-within:text-sky-600"
            aria-hidden
          />
          <input
            id="global-search"
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (searchQuery) {
                  setSearchQuery("");
                } else {
                  event.currentTarget.blur();
                }
              }
            }}
            placeholder="Find any link…"
            className="h-12 w-full bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400/90"
            autoComplete="off"
            spellCheck={false}
          />
          {showEnterHint ? (
            <span className="hidden shrink-0 rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 sm:inline-flex">
              Enter to open
            </span>
          ) : null}
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              className="inline-flex size-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded-lg bg-slate-100/80 px-2 py-1 text-[11px] font-medium tracking-wide text-slate-500 sm:inline-flex">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    </div>
  );
}
