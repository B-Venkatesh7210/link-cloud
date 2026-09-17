"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppState } from "@/components/app-shell/app-state";
import { TagInput } from "@/components/links/tag-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createLinkAction,
  createLinksBulkAction,
} from "@/lib/links/actions";
import type { ImportDraft } from "@/lib/import/parse-links-file";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function ImportShell({
  open,
  onOpenChange,
  isMobile,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] bg-white/90 px-5 pb-6 pt-4 backdrop-blur-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Import links</SheetTitle>
            <SheetDescription>
              Review each URL, then add it — or add everything at once.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">{children}</div>
          <SheetFooter className="mt-6 gap-2 sm:flex-col">{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[1.75rem] border-0 bg-white/90 p-6 shadow-xl backdrop-blur-xl sm:p-7">
        <DialogHeader>
          <DialogTitle>Import links</DialogTitle>
          <DialogDescription>
            Review each URL, then add it — or add everything at once.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">{children}</div>
        <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportQueueDialog() {
  const {
    isImportOpen,
    importQueue,
    importIndex,
    closeImportQueue,
    setImportIndex,
    updateImportDraft,
    removeImportDraft,
    setLinks,
    allTagNames,
  } = useAppState();
  const isMobile = useIsMobile();
  const [pending, startTransition] = useTransition();
  const [bulkPending, startBulk] = useTransition();
  const labelRef = useRef<HTMLInputElement | null>(null);

  const current = importQueue[importIndex] ?? null;
  const remaining = importQueue.length;
  const progressLabel =
    remaining === 0
      ? "Done"
      : `${Math.min(importIndex + 1, remaining)} of ${remaining}`;

  const draftView = useMemo(() => current, [current]);

  useEffect(() => {
    if (!isImportOpen || !current) return;
    const timer = window.setTimeout(() => {
      labelRef.current?.focus();
      labelRef.current?.select();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [current?.id, isImportOpen]);

  useEffect(() => {
    if (isImportOpen && importQueue.length === 0) {
      closeImportQueue();
    }
  }, [closeImportQueue, importQueue.length, isImportOpen]);

  function onSkip() {
    if (!current) return;
    removeImportDraft(current.id);
  }

  function onAddThis() {
    if (!current) return;
    const draft: ImportDraft = {
      ...current,
      label: current.label.trim() || current.url,
      tags: current.tags,
    };

    startTransition(async () => {
      const result = await createLinkAction({
        url: draft.url,
        label: draft.label,
        tags: draft.tags,
      });

      if (!result.success) {
        if (result.code === "DUPLICATE") {
          toast.message("Already in your sky — skipped");
          removeImportDraft(draft.id);
          return;
        }
        toast.error(result.error);
        return;
      }

      setLinks((prev) => [
        result.data,
        ...prev.filter((link) => link.id !== result.data.id),
      ]);
      toast.success("Link added");
      removeImportDraft(draft.id);
    });
  }

  function onAddAll() {
    if (importQueue.length === 0) return;

    startBulk(async () => {
      const payload = importQueue.map((item) => ({
        url: item.url,
        label: item.label.trim() || item.url,
        tags: item.tags,
      }));

      const result = await createLinksBulkAction(payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const { created, skippedDuplicates, failed } = result.data;
      if (created.length > 0) {
        setLinks((prev) => {
          const ids = new Set(created.map((link) => link.id));
          return [...created, ...prev.filter((link) => !ids.has(link.id))];
        });
      }

      closeImportQueue();

      const parts = [`${created.length} added`];
      if (skippedDuplicates > 0) parts.push(`${skippedDuplicates} already saved`);
      if (failed > 0) parts.push(`${failed} failed`);
      toast.success(parts.join(" · "));
    });
  }

  if (!draftView && isImportOpen) {
    return null;
  }

  return (
    <ImportShell
      open={isImportOpen && Boolean(draftView)}
      onOpenChange={(open) => {
        if (!open) closeImportQueue();
      }}
      isMobile={isMobile}
      footer={
        <>
          <Button
            type="button"
            className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            disabled={pending || bulkPending || !draftView}
            onClick={onAddThis}
          >
            {pending ? "Adding…" : "Add this link"}
          </Button>
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              disabled={pending || bulkPending}
              onClick={onSkip}
            >
              Skip
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              disabled={pending || bulkPending || remaining === 0}
              onClick={onAddAll}
            >
              {bulkPending
                ? "Adding all…"
                : `Add all (${remaining})`}
            </Button>
          </div>
        </>
      }
    >
      {draftView ? (
        <>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {progressLabel}
          </p>

          <div className="space-y-2">
            <Label htmlFor="import-url">URL</Label>
            <Input
              id="import-url"
              value={draftView.url}
              readOnly
              className="rounded-xl bg-slate-50 text-slate-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-label">Label</Label>
            <Input
              id="import-label"
              ref={labelRef}
              value={draftView.label}
              disabled={pending || bulkPending}
              onChange={(event) =>
                updateImportDraft(draftView.id, { label: event.target.value })
              }
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput
              value={draftView.tags}
              onChange={(tags) => updateImportDraft(draftView.id, { tags })}
              disabled={pending || bulkPending}
              suggestions={allTagNames}
            />
          </div>
        </>
      ) : null}
    </ImportShell>
  );
}
