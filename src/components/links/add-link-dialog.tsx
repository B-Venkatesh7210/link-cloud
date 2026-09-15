"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, LoaderCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createLinkAction,
  mergeTagsIntoLinkAction,
  updateLinkAction,
} from "@/lib/links/actions";
import { fetchLinkMetadataAction } from "@/lib/metadata/actions";
import { createLinkFormSchema, type CreateLinkFormValues } from "@/lib/schemas";
import { normalizeUrl } from "@/lib/normalize-url";
import type { LinkWithTags } from "@/lib/types";

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

function guessLabel(url: string): string {
  if (!url) return "";
  try {
    return normalizeUrl(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostnameOf(url: string): string {
  try {
    return normalizeUrl(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function LinkForm({
  mode,
  initialUrl,
  initialLink,
  onCancel,
  onSaved,
  focusLabel,
}: {
  mode: "create" | "edit";
  initialUrl: string;
  initialLink?: LinkWithTags | null;
  onCancel: () => void;
  onSaved: (link?: LinkWithTags) => void;
  focusLabel?: boolean;
}) {
  const { setLinks, allTagNames, openEditLink, setSelectedLinkId } =
    useAppState();
  const [tags, setTags] = useState<string[]>(
    initialLink?.tags.map((tag) => tag.name) ?? []
  );
  const [notesOpen, setNotesOpen] = useState(Boolean(initialLink?.notes));
  const [pending, startTransition] = useTransition();
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [hostname, setHostname] = useState(
    hostnameOf(initialLink?.url ?? initialUrl)
  );
  const [metaFields, setMetaFields] = useState<{
    page_title: string | null;
    description: string | null;
    favicon_url: string | null;
  }>({
    page_title: initialLink?.page_title ?? null,
    description: initialLink?.description ?? null,
    favicon_url: initialLink?.favicon_url ?? null,
  });
  const [duplicate, setDuplicate] = useState<LinkWithTags | null>(null);
  const labelTouchedRef = useRef(Boolean(initialLink));
  const labelRef = useRef<HTMLInputElement | null>(null);
  const urlRef = useRef<HTMLInputElement | null>(null);
  const metaRequestRef = useRef(0);

  const defaults = useMemo<CreateLinkFormValues>(
    () => ({
      url: initialLink?.url ?? initialUrl,
      label: initialLink?.label ?? guessLabel(initialUrl),
      notes: initialLink?.notes ?? "",
      tags: [],
    }),
    [initialLink, initialUrl]
  );

  const form = useForm<CreateLinkFormValues>({
    resolver: zodResolver(createLinkFormSchema),
    defaultValues: defaults,
  });

  const { ref: labelRegisterRef, ...labelRegister } = form.register("label");
  const { ref: urlRegisterRef, ...urlRegister } = form.register("url");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (focusLabel && defaults.url) {
        labelRef.current?.focus();
        labelRef.current?.select();
      } else {
        urlRef.current?.focus();
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [defaults.url, focusLabel]);

  // Async metadata for create flow
  useEffect(() => {
    if (mode !== "create") return;
    const url = defaults.url;
    if (!url.trim()) return;

    let cancelled = false;
    const requestId = ++metaRequestRef.current;
    let started = false;

    const start = () => {
      if (cancelled || started) return;
      started = true;
      setFetchingMeta(true);
      setHostname(hostnameOf(url));
    };

    const timer = window.setTimeout(start, 0);

    void fetchLinkMetadataAction(url).then((result) => {
      if (cancelled || requestId !== metaRequestRef.current) return;
      setFetchingMeta(false);
      if (!result.success) return;

      setHostname(result.data.hostname.replace(/^www\./, ""));
      setMetaFields({
        page_title: result.data.metadata?.title ?? null,
        description: result.data.metadata?.description ?? null,
        favicon_url: result.data.metadata?.faviconUrl ?? null,
      });

      if (!labelTouchedRef.current && result.data.suggestedLabel) {
        form.setValue("label", result.data.suggestedLabel, {
          shouldDirty: false,
        });
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, defaults.url, form]);

  function onSubmit(values: CreateLinkFormValues) {
    startTransition(async () => {
      if (mode === "edit" && initialLink) {
        const result = await updateLinkAction({
          id: initialLink.id,
          url: values.url,
          label: values.label,
          notes: values.notes || null,
          tags,
        });

        if (!result.success) {
          toast.error(result.error);
          return;
        }

        setLinks((prev) =>
          prev.map((link) => (link.id === result.data.id ? result.data : link))
        );
        toast.success("Link updated");
        onSaved(result.data);
        return;
      }

      const result = await createLinkAction({
        ...values,
        tags,
        notes: values.notes || null,
        page_title: metaFields.page_title,
        description: metaFields.description,
        favicon_url: metaFields.favicon_url,
      });

      if (!result.success) {
        if (result.code === "DUPLICATE" && result.existing) {
          setDuplicate(result.existing);
          return;
        }
        toast.error(result.error);
        return;
      }

      setLinks((prev) => [
        result.data,
        ...prev.filter((link) => link.id !== result.data.id),
      ]);
      toast.success("Link saved");
      onSaved(result.data);
    });
  }

  if (duplicate) {
    const incomingTags = tags.filter(
      (tag) =>
        !duplicate.tags.some(
          (existing) => existing.name.toLowerCase() === tag.toLowerCase()
        )
    );

    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-sky-50/80 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">
            You already saved this link.
          </p>
          <p className="mt-1 truncate text-sm text-slate-500">
            {duplicate.label} · {duplicate.hostname.replace(/^www\./, "")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => {
              window.open(duplicate.url, "_blank", "noopener,noreferrer");
              onCancel();
            }}
          >
            Open existing
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => {
              setSelectedLinkId(duplicate.id);
              openEditLink(duplicate.id);
              onCancel();
            }}
          >
            Edit existing
          </Button>
          {incomingTags.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await mergeTagsIntoLinkAction(
                    duplicate.id,
                    incomingTags
                  );
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  setLinks((prev) =>
                    prev.map((link) =>
                      link.id === result.data.id ? result.data : link
                    )
                  );
                  toast.success("Tags added to existing link");
                  onSaved(result.data);
                });
              }}
            >
              Add {incomingTags.length} tag
              {incomingTags.length === 1 ? "" : "s"} to existing
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-xl"
            onClick={() => setDuplicate(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          void form.handleSubmit(onSubmit)();
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="space-y-2">
        <Label htmlFor="link-url">URL</Label>
        <Input
          id="link-url"
          placeholder="https://…"
          disabled={pending}
          {...urlRegister}
          ref={(element) => {
            urlRegisterRef(element);
            urlRef.current = element;
          }}
          onBlur={(event) => {
            urlRegister.onBlur(event);
            const next = event.target.value;
            setHostname(hostnameOf(next));
          }}
        />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {hostname ? <span>{hostname}</span> : null}
          {fetchingMeta ? (
            <span className="inline-flex items-center gap-1 text-sky-700">
              <LoaderCircle className="size-3 animate-spin" />
              Fetching details…
            </span>
          ) : null}
        </div>
        {form.formState.errors.url ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.url.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="link-label">Label</Label>
        <Input
          id="link-label"
          placeholder="What should this be called?"
          disabled={pending}
          {...labelRegister}
          onChange={(event) => {
            labelTouchedRef.current = true;
            void labelRegister.onChange(event);
          }}
          ref={(element) => {
            labelRegisterRef(element);
            labelRef.current = element;
          }}
        />
        {form.formState.errors.label ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.label.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="link-tags">Tags</Label>
        <TagInput
          value={tags}
          onChange={setTags}
          disabled={pending}
          suggestions={allTagNames}
        />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
          onClick={() => setNotesOpen((open) => !open)}
        >
          <ChevronDown
            className={`size-4 transition ${notesOpen ? "rotate-180" : ""}`}
          />
          Notes
        </button>
        {notesOpen ? (
          <Textarea
            id="link-notes"
            placeholder="Optional context…"
            rows={3}
            disabled={pending}
            {...form.register("notes")}
          />
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
          className="h-11 rounded-xl sm:h-9"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 sm:h-9"
        >
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Save link"}
        </Button>
      </div>
      <p className="text-center text-[11px] text-slate-400 sm:text-right">
        ⌘/Ctrl+Enter to save
      </p>
    </form>
  );
}

function FormShell({
  open,
  onOpenChange,
  title,
  description,
  isMobile,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isMobile: boolean;
  children: ReactNode;
}) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="px-0 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{children}</div>
          <SheetFooter className="sr-only" />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="sr-only" />
      </DialogContent>
    </Dialog>
  );
}

export function AddLinkDialog() {
  const { isAddLinkOpen, closeAddLink, addLinkInitialUrl } = useAppState();
  const isMobile = useIsMobile();
  const formKey = `${isAddLinkOpen}:${addLinkInitialUrl}`;

  return (
    <FormShell
      open={isAddLinkOpen}
      onOpenChange={(open) => {
        if (!open) closeAddLink();
      }}
      title="Add link"
      description="Save a URL to your personal sky."
      isMobile={isMobile}
    >
      {isAddLinkOpen ? (
        <LinkForm
          key={formKey}
          mode="create"
          initialUrl={addLinkInitialUrl}
          focusLabel={Boolean(addLinkInitialUrl)}
          onCancel={closeAddLink}
          onSaved={() => closeAddLink()}
        />
      ) : null}
    </FormShell>
  );
}

export function EditLinkDialog() {
  const { editingLink, closeEditLink } = useAppState();
  const isMobile = useIsMobile();

  return (
    <FormShell
      open={Boolean(editingLink)}
      onOpenChange={(open) => {
        if (!open) closeEditLink();
      }}
      title="Edit link"
      description="Update this destination in your sky."
      isMobile={isMobile}
    >
      {editingLink ? (
        <LinkForm
          key={editingLink.id}
          mode="edit"
          initialUrl={editingLink.url}
          initialLink={editingLink}
          onCancel={closeEditLink}
          onSaved={() => closeEditLink()}
        />
      ) : null}
    </FormShell>
  );
}
