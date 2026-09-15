"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import {
  Archive,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { domainAvatarStyle } from "@/lib/cloud/domain-avatar";
import type { UrlBubbleNodeData } from "@/lib/cloud/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type UrlBubbleFlowNode = Node<UrlBubbleNodeData, "urlBubble">;

function Favicon({
  src,
  hostname,
  visualSeed,
}: {
  src: string | null;
  hostname: string;
  visualSeed: number;
}) {
  const [failed, setFailed] = useState(false);
  const avatar = domainAvatarStyle(hostname, visualSeed);

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
          avatar.bg,
          avatar.text
        )}
        aria-hidden
      >
        {avatar.initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={32}
      height={32}
      className="size-8 shrink-0 rounded-xl bg-white/80 object-contain p-1 shadow-sm ring-1 ring-slate-200/60"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function UrlBubbleNodeComponent({ data, selected }: NodeProps<UrlBubbleFlowNode>) {
  const reduceMotion = useReducedMotion();
  const lastClickRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimer = useRef<number | null>(null);
  const {
    link,
    scale,
    opacity,
    searching,
    selected: isSelected,
    isMobile,
    recentEmphasis,
    onSelect,
    onOpen,
    onToggleFavorite,
    onCopy,
    onEdit,
    onArchive,
  } = data;

  const active = isSelected || selected;
  const tags = link.tags.slice(0, scale >= 1.15 ? 3 : 2);

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
    };
  }, []);

  const onBubbleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const now = Date.now();
      if (now - lastClickRef.current < 320) {
        onOpen(link.id);
        lastClickRef.current = 0;
        return;
      }
      lastClickRef.current = now;
      onSelect(link.id);
    },
    [link.id, onOpen, onSelect]
  );

  return (
    <motion.div
      layout={!reduceMotion}
      initial={false}
      animate={{
        scale,
        opacity,
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 280, damping: 28, mass: 0.8 }
      }
      className="group relative"
      style={{ transformOrigin: "center center" }}
    >
      <Handle type="target" position={Position.Top} className="!pointer-events-none !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!pointer-events-none !opacity-0" />

      <div
        role="button"
        tabIndex={0}
        aria-label={`${link.label}, ${link.hostname}`}
        aria-pressed={active}
        onClick={onBubbleClick}
        onContextMenu={(event) => {
          if (isMobile) return;
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true);
          onSelect(link.id);
        }}
        onMouseEnter={() => {
          if (isMobile || searching) return;
          tooltipTimer.current = window.setTimeout(
            () => setTooltipVisible(true),
            450
          );
        }}
        onMouseLeave={() => {
          if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
          setTooltipVisible(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(link.id);
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onOpen(link.id);
          }
        }}
        className={cn(
          "relative w-[196px] cursor-pointer rounded-[1.6rem] border bg-white/78 px-3.5 py-3 text-left shadow-[0_10px_30px_rgba(70,120,180,0.10)] outline-none backdrop-blur-[2px] transition-[box-shadow,border-color,background-color] duration-200",
          "hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_16px_40px_rgba(70,120,180,0.16)]",
          "focus-visible:ring-2 focus-visible:ring-sky-300/80",
          active
            ? "border-sky-300/90 ring-2 ring-sky-200/70"
            : "border-white/80",
          recentEmphasis && !searching && "ring-1 ring-sky-200/50",
          scale >= 1.25 && "w-[228px] rounded-[1.85rem] px-4 py-3.5",
          scale < 0.95 && "w-[168px] rounded-[1.4rem] px-3 py-2.5"
        )}
      >
        {link.is_favorite ? (
          <span
            className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-amber-50 text-amber-500 shadow-sm ring-1 ring-amber-200/80"
            aria-label="Favorite"
          >
            <Star className="size-3 fill-current" />
          </span>
        ) : null}

        <div className="flex items-start gap-2.5">
          <Favicon
            src={link.favicon_url}
            hostname={link.hostname}
            visualSeed={link.visual_seed}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-tight text-slate-800">
              {link.label}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {link.hostname.replace(/^www\./, "")}
            </p>
          </div>
        </div>

        {tags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-[7.5rem] truncate rounded-md bg-sky-50/90 px-1.5 py-0.5 text-[10px] font-medium text-sky-800/90"
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {!isMobile && tooltipVisible && !menuOpen ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl bg-slate-900/95 px-3 py-2 text-left text-white shadow-lg"
          >
            <p className="truncate text-xs font-medium">{link.label}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-300">
              {link.hostname.replace(/^www\./, "")}
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-400">
              {truncateUrl(link.url)}
            </p>
            {link.tags.length > 0 ? (
              <p className="mt-1 truncate text-[10px] text-sky-200">
                {link.tags.map((t) => t.name).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200/70 transition",
            isMobile || active
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
            aria-label="Open link"
            onClick={() => onOpen(link.id)}
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
            aria-label={link.is_favorite ? "Remove favorite" : "Favorite"}
            onClick={() => onToggleFavorite(link.id, !link.is_favorite)}
          >
            <Star
              className={cn(
                "size-3.5",
                link.is_favorite && "fill-amber-400 text-amber-500"
              )}
            />
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-40">
              <DropdownMenuItem className="gap-2" onClick={() => onOpen(link.id)}>
                <ExternalLink className="size-4" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onCopy(link.id)}>
                <Copy className="size-4" />
                Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onEdit(link.id)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => onToggleFavorite(link.id, !link.is_favorite)}
              >
                <Star className="size-4" />
                {link.is_favorite ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2"
                onClick={() => onArchive(link.id)}
              >
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

export const UrlBubbleNode = memo(UrlBubbleNodeComponent);
