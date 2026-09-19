"use client";

import { useEffect } from "react";
import { useAppState } from "@/components/app-shell/app-state";
import { CLUSTERS_UNLOCK_COUNT } from "@/lib/clusters/constants";
import { cn } from "@/lib/utils";

export function CanvasModeSwitch() {
  const { links, canvasMode, setCanvasMode, setFocusClusterId } = useAppState();
  const activeCount = links.filter((link) => !link.archived_at).length;
  const unlocked = activeCount > CLUSTERS_UNLOCK_COUNT;

  useEffect(() => {
    if (!unlocked && canvasMode === "clusters") {
      setCanvasMode("cloud");
      setFocusClusterId(null);
    }
  }, [unlocked, canvasMode, setCanvasMode, setFocusClusterId]);

  return (
    <div className="pointer-events-none absolute top-[max(3.75rem,calc(env(safe-area-inset-top)+3.25rem))] left-4 z-30 sm:left-5">
      <div className="pointer-events-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            setCanvasMode("cloud");
            setFocusClusterId(null);
          }}
          className={cn(
            "rounded-xl px-3 py-1.5 text-left text-[13px] font-medium transition",
            canvasMode === "cloud"
              ? "bg-white/80 text-slate-800 shadow-sm ring-1 ring-white/70"
              : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
          )}
        >
          Cloud
        </button>
        <button
          type="button"
          disabled={!unlocked}
          title={
            unlocked
              ? "Browse nested clusters"
              : `Add more than ${CLUSTERS_UNLOCK_COUNT} links to unlock Clusters`
          }
          onClick={() => {
            if (!unlocked) return;
            setCanvasMode("clusters");
            setFocusClusterId(null);
          }}
          className={cn(
            "rounded-xl px-3 py-1.5 text-left text-[13px] font-medium transition",
            !unlocked && "cursor-not-allowed opacity-40",
            unlocked &&
              canvasMode === "clusters" &&
              "bg-white/80 text-slate-800 shadow-sm ring-1 ring-white/70",
            unlocked &&
              canvasMode !== "clusters" &&
              "text-slate-500 hover:bg-white/50 hover:text-slate-700"
          )}
        >
          Clusters
        </button>
      </div>
    </div>
  );
}
