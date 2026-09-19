"use client";

import { memo } from "react";
import { useStore, type Node, type NodeProps } from "@xyflow/react";
import { Folder } from "lucide-react";
import { displayClusterName } from "@/lib/clusters/normalize";
import type { Cluster } from "@/lib/clusters/types";
import type { LinkWithTags } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ClusterFlowNodeData = {
  cluster: Cluster;
  linkCount: number;
  childClusterCount: number;
  previewLinks: LinkWithTags[];
  dropTarget?: boolean;
  onOpen: (id: string) => void;
  onDropHere?: (id: string) => void;
};

export type ClusterFlowNode = Node<ClusterFlowNodeData, "cluster">;

function ClusterNodeComponent({ data }: NodeProps<ClusterFlowNode>) {
  const zoom = useStore((s) => s.transform[2]);
  const lite = zoom < 0.7;
  const { cluster, linkCount, childClusterCount, previewLinks, dropTarget } =
    data;
  const title = displayClusterName(cluster.name);

  return (
    <button
      type="button"
      onClick={() => data.onOpen(cluster.id)}
      onPointerUp={(event) => {
        if (!data.onDropHere) return;
        event.stopPropagation();
        data.onDropHere(cluster.id);
      }}
      className={cn(
        "group flex w-[200px] flex-col items-stretch rounded-[1.5rem] border border-transparent bg-white/90 px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(70,120,180,0.12)] transition",
        !lite && "backdrop-blur-md",
        dropTarget && "ring-2 ring-sky-400/80",
        "hover:-translate-y-0.5 hover:border-sky-200/80"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <Folder className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-tight text-slate-800">
            {title}
          </p>
          <p className="text-[11px] text-slate-500">
            {linkCount} link{linkCount === 1 ? "" : "s"}
            {childClusterCount > 0
              ? ` · ${childClusterCount} nested`
              : ""}
          </p>
        </div>
      </div>
      {!lite && previewLinks.length > 0 ? (
        <div className="mt-2.5 flex -space-x-1.5">
          {previewLinks.map((link) =>
            link.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={link.id}
                src={link.favicon_url}
                alt=""
                width={22}
                height={22}
                loading="lazy"
                className="size-[22px] rounded-md bg-white object-contain ring-2 ring-white"
              />
            ) : (
              <span
                key={link.id}
                className="flex size-[22px] items-center justify-center rounded-md bg-slate-100 text-[9px] font-semibold text-slate-500 ring-2 ring-white"
              >
                {(link.label[0] ?? "?").toUpperCase()}
              </span>
            )
          )}
        </div>
      ) : null}
    </button>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);
