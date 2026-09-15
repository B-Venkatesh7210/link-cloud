"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Copy,
  ExternalLink,
  Pencil,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LinkWithTags } from "@/lib/types";

function DetailBody({
  link,
  onOpen,
  onCopy,
  onEdit,
  onToggleFavorite,
  onArchive,
  onClose,
}: {
  link: LinkWithTags;
  onOpen: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight text-slate-800">
            {link.label}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500">
            {link.hostname.replace(/^www\./, "")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          aria-label="Close details"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-sky-700 underline-offset-2 hover:underline"
      >
        {link.url}
      </a>

      {link.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {link.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800"
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}

      {link.notes ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {link.notes}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-xs text-slate-500">
        <div>
          <dt className="font-medium text-slate-400">Created</dt>
          <dd className="mt-0.5 text-slate-700">
            {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Last opened</dt>
          <dd className="mt-0.5 text-slate-700">
            {link.last_opened_at
              ? formatDistanceToNow(new Date(link.last_opened_at), {
                  addSuffix: true,
                })
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Opens</dt>
          <dd className="mt-0.5 text-slate-700">{link.open_count}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-400">Favorite</dt>
          <dd className="mt-0.5 text-slate-700">
            {link.is_favorite ? "Yes" : "No"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          onClick={onOpen}
        >
          <ExternalLink className="size-4" />
          Open
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={onCopy}
        >
          <Copy className="size-4" />
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={onToggleFavorite}
        >
          <Star
            className={
              link.is_favorite ? "size-4 fill-amber-400 text-amber-500" : "size-4"
            }
          />
          {link.is_favorite ? "Unfavorite" : "Favorite"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-xl text-slate-600"
          onClick={onArchive}
        >
          <Archive className="size-4" />
          Archive
        </Button>
      </div>
    </div>
  );
}

export function LinkDetailPanel({
  link,
  isMobile,
  onClose,
  onOpen,
  onCopy,
  onEdit,
  onToggleFavorite,
  onArchive,
}: {
  link: LinkWithTags | null;
  isMobile: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleFavorite: (id: string, next: boolean) => void;
  onArchive: (id: string) => void;
}) {
  if (!link) return null;

  if (isMobile) {
    return (
      <Sheet
        open={Boolean(link)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8 pt-5">
          <SheetHeader className="sr-only">
            <SheetTitle>{link.label}</SheetTitle>
            <SheetDescription>Link details</SheetDescription>
          </SheetHeader>
          <DetailBody
            link={link}
            onClose={onClose}
            onOpen={() => onOpen(link.id)}
            onCopy={() => onCopy(link.id)}
            onEdit={() => onEdit(link.id)}
            onToggleFavorite={() =>
              onToggleFavorite(link.id, !link.is_favorite)
            }
            onArchive={() => onArchive(link.id)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="pointer-events-none absolute top-24 right-5 z-30 hidden w-[340px] md:block"
      aria-label="Link details"
    >
      <div className="pointer-events-auto rounded-[1.75rem] bg-white/80 p-5 shadow-[0_20px_50px_rgba(70,120,180,0.14)] ring-1 ring-white/80 backdrop-blur-xl">
        <DetailBody
          link={link}
          onClose={onClose}
          onOpen={() => onOpen(link.id)}
          onCopy={() => onCopy(link.id)}
          onEdit={() => onEdit(link.id)}
          onToggleFavorite={() =>
            onToggleFavorite(link.id, !link.is_favorite)
          }
          onArchive={() => onArchive(link.id)}
        />
      </div>
    </aside>
  );
}
