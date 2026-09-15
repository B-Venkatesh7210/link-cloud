"use client";

import { LocateFixed, Minus, Plus, Maximize2 } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";

export function ViewportControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();

  return (
    <div className="pointer-events-none absolute bottom-5 left-4 z-20 sm:bottom-6 sm:left-5">
      <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-slate-600 hover:bg-white/80"
          aria-label="Zoom in"
          onClick={() => zoomIn({ duration: 200 })}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-slate-600 hover:bg-white/80"
          aria-label="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        >
          <Minus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-slate-600 hover:bg-white/80"
          aria-label="Reset view"
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 280 })}
        >
          <LocateFixed className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-slate-600 hover:bg-white/80"
          aria-label="View all links"
          onClick={() =>
            fitView({
              padding: 0.18,
              duration: 320,
              maxZoom: 1.15,
              minZoom: 0.35,
            })
          }
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
