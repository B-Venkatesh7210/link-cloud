import type { LinkWithTags } from "@/lib/types";
import type { PresentableLink } from "@/lib/search/fuse";

export type UrlBubbleNodeData = {
  link: LinkWithTags;
  scale: number;
  opacity: number;
  searching: boolean;
  matched: boolean;
  searchRank: number;
  selected: boolean;
  isMobile: boolean;
  recentEmphasis?: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string, next: boolean) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
};

export function toPresentableMap(items: PresentableLink[]) {
  return new Map(items.map((item) => [item.id, item]));
}
