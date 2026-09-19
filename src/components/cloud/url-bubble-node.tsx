"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Handle,
  Position,
  useStore,
  type NodeProps,
  type Node,
} from "@xyflow/react";
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
import { bubbleSurfaceFromAccent } from "@/lib/cloud/accent-color";
import { domainAvatarStyle } from "@/lib/cloud/domain-avatar";
import { bubbleTiltDegrees } from "@/lib/cloud/sizing";
import type { UrlBubbleNodeData } from "@/lib/cloud/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type UrlBubbleFlowNode = Node<UrlBubbleNodeData, "urlBubble">;

/** Below this zoom, render compact chips (LOD). */
export const BUBBLE_LITE_ZOOM = 0.72;
/** Below this zoom (or when dense), skip backdrop-blur. */
export const BUBBLE_SOLID_ZOOM = 0.88;

function Favicon({
  src,
  hostname,
  visualSeed,
  compact,
}: {
  src: string | null;
  hostname: string;
  visualSeed: number;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const avatar = domainAvatarStyle(hostname, visualSeed);
  const size = compact ? "size-6" : "size-9";
  const radius = compact ? "rounded-lg" : "rounded-2xl";

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center font-semibold shadow-sm ring-1 ring-white/70",
          size,
          radius,
          compact ? "text-[10px]" : "text-xs",
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
      width={compact ? 24 : 36}
      height={compact ? 24 : 36}
      loading="lazy"
      decoding="async"
      className={cn(
        "shrink-0 bg-white/90 object-contain shadow-sm ring-1 ring-white/80",
        size,
        radius,
        compact ? "p-0.5" : "p-1.5"
      )}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function BubbleActions({
  linkId,
  isFavorite,
  menuOpen,
  setMenuOpen,
  onOpen,
  onToggleFavorite,
  onCopy,
  onEdit,
  onArchive,
  alwaysVisible,
}: {
  linkId: string;
  isFavorite: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string, next: boolean) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  alwaysVisible: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200/70 transition",
        alwaysVisible
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
        onClick={() => onOpen(linkId)}
      >
        <ExternalLink className="size-3.5" />
      </button>
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
        aria-label={isFavorite ? "Remove favorite" : "Favorite"}
        onClick={() => onToggleFavorite(linkId, !isFavorite)}
      >
        <Star
          className={cn(
            "size-3.5",
            isFavorite && "fill-amber-400 text-amber-500"
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
          <DropdownMenuItem className="gap-2" onClick={() => onOpen(linkId)}>
            <ExternalLink className="size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => onCopy(linkId)}>
            <Copy className="size-4" />
            Copy URL
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => onEdit(linkId)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => onToggleFavorite(linkId, !isFavorite)}
          >
            <Star className="size-4" />
            {isFavorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => onArchive(linkId)}>
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UrlBubbleNodeComponent({ data, selected }: NodeProps<UrlBubbleFlowNode>) {
  const reduceMotion = useReducedMotion();
  const lastClickRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
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
    dense,
    onSelect,
    onOpen,
    onToggleFavorite,
    onCopy,
    onEdit,
    onArchive,
  } = data;

  // Bucketed zoom — re-render only when crossing LOD thresholds.
  const lod = useStore((state) => {
    const zoom = state.transform[2];
    if (zoom < BUBBLE_LITE_ZOOM) return "lite" as const;
    if (zoom < BUBBLE_SOLID_ZOOM || dense) return "solid" as const;
    return "full" as const;
  });

  const active = isSelected || selected;
  const lite = lod === "lite";
  const solid = lod === "solid" || lod === "lite";
  const tags = lite ? [] : link.tags.slice(0, scale >= 1.15 ? 3 : 2);
  const baseTilt = bubbleTiltDegrees(link.visual_seed);
  const tilt = searching || active || lite ? 0 : baseTilt;
  const surface = bubbleSurfaceFromAccent(link.accent_color);
  const showChrome = !lite && (hovered || active || menuOpen || isMobile);

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
    };
  }, []);

  const onBubbleClick = useCallback(
    (event: ReactMouseEvent) => {
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

  const card = (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${link.label}, ${link.hostname}`}
      aria-pressed={active}
      onClick={onBubbleClick}
      onContextMenu={(event) => {
        if (isMobile || lite) return;
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
        onSelect(link.id);
      }}
      onMouseEnter={() => {
        setHovered(true);
        if (isMobile || searching || lite) return;
        tooltipTimer.current = window.setTimeout(
          () => setTooltipVisible(true),
          450
        );
      }}
      onMouseLeave={() => {
        setHovered(false);
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
        "relative cursor-pointer border border-transparent text-left outline-none transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
        lite
          ? "bubble-chip flex w-[168px] items-center gap-2 rounded-full px-2.5 py-1.5"
          : cn(
              "flex w-[280px] max-w-[320px] items-start gap-3 rounded-[1.75rem] px-3.5 py-3",
              solid ? "bubble-solid" : "bubble-glass backdrop-blur-xl",
              "hover:-translate-y-0.5",
              scale >= 1.25 && "w-[320px] rounded-[2rem] px-4 py-3.5",
              scale < 0.95 && "w-[240px] rounded-[1.5rem] px-3 py-2.5"
            ),
        "focus-visible:ring-2 focus-visible:ring-sky-300/70",
        active && !lite && (solid ? "bubble-solid-active" : "bubble-glass-active"),
        recentEmphasis && !searching && !lite && "ring-1 ring-sky-200/40"
      )}
      style={
        {
          backgroundColor: surface.background,
          opacity,
          ["--bubble-accent-border"]: surface.border,
        } as CSSProperties
      }
    >
      {link.is_favorite && !lite ? (
        <span
          className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-amber-50/95 text-amber-500 shadow-sm ring-1 ring-amber-200/80"
          aria-label="Favorite"
        >
          <Star className="size-3 fill-current" />
        </span>
      ) : null}

      <Favicon
        src={link.favicon_url}
        hostname={link.hostname}
        visualSeed={link.visual_seed}
        compact={lite}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-semibold tracking-tight text-slate-800",
            lite ? "text-[12px]" : "text-[14px]"
          )}
        >
          {link.label}
        </p>
        {!lite ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500/90">
            {link.hostname.replace(/^www\./, "")}
          </p>
        ) : null}
        {tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="max-w-[7.5rem] truncate rounded-full bg-white/55 px-2 py-0.5 text-[10px] font-medium text-sky-800/85 ring-1 ring-white/70"
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {!isMobile && !lite && tooltipVisible && !menuOpen ? (
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

      {showChrome ? (
        <BubbleActions
          linkId={link.id}
          isFavorite={link.is_favorite}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onCopy={onCopy}
          onEdit={onEdit}
          onArchive={onArchive}
          alwaysVisible={isMobile || active}
        />
      ) : null}
    </div>
  );

  if (lite || reduceMotion) {
    return (
      <div
        className="group relative"
        style={{
          transformOrigin: "center center",
          transform: `scale(${scale}) rotate(${tilt}deg)`,
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!pointer-events-none !opacity-0"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!pointer-events-none !opacity-0"
        />
        {card}
      </div>
    );
  }

  return (
    <motion.div
      initial={false}
      animate={{
        scale,
        opacity: 1,
        rotate: tilt,
      }}
      transition={{ type: "spring", stiffness: 280, damping: 28, mass: 0.8 }}
      className="group relative"
      style={{ transformOrigin: "center center" }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!pointer-events-none !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!pointer-events-none !opacity-0"
      />
      {card}
    </motion.div>
  );
}

function bubblePropsAreEqual(
  prev: NodeProps<UrlBubbleFlowNode>,
  next: NodeProps<UrlBubbleFlowNode>
) {
  const a = prev.data;
  const b = next.data;
  return (
    prev.selected === next.selected &&
    a.link === b.link &&
    a.scale === b.scale &&
    a.opacity === b.opacity &&
    a.searching === b.searching &&
    a.matched === b.matched &&
    a.searchRank === b.searchRank &&
    a.selected === b.selected &&
    a.isMobile === b.isMobile &&
    a.recentEmphasis === b.recentEmphasis &&
    a.dense === b.dense
  );
}

export const UrlBubbleNode = memo(UrlBubbleNodeComponent, bubblePropsAreEqual);
