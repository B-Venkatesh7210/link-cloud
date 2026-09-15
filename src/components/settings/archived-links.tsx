"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteLinkAction,
  restoreLinkAction,
} from "@/lib/links/actions";
import type { LinkWithTags } from "@/lib/types";

export function ArchivedLinksSection({
  initialArchived,
}: {
  initialArchived: LinkWithTags[];
}) {
  const [archived, setArchived] = useState(initialArchived);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (archived.length === 0) {
    return (
      <div className="border-t border-slate-200/80 pt-6">
        <h2 className="text-base font-semibold text-slate-800">Archived links</h2>
        <p className="mt-1 text-sm text-slate-500">
          Nothing archived yet. Archived links leave your sky but stay recoverable here.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200/80 pt-6">
      <h2 className="text-base font-semibold text-slate-800">Archived links</h2>
      <p className="mt-1 text-sm text-slate-500">
        Restore to bring a link back to the sky, or delete permanently.
      </p>

      <ul className="mt-4 space-y-3">
        {archived.map((link) => (
          <li
            key={link.id}
            className="flex flex-col gap-3 rounded-2xl bg-slate-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {link.label}
              </p>
              <p className="truncate text-xs text-slate-500">{link.hostname}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                disabled={pendingId === link.id}
                onClick={() => {
                  setPendingId(link.id);
                  startTransition(async () => {
                    const result = await restoreLinkAction(link.id);
                    setPendingId(null);
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    setArchived((items) =>
                      items.filter((item) => item.id !== link.id)
                    );
                    toast.success("Link restored");
                  });
                }}
              >
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={pendingId === link.id}
                onClick={() => {
                  const confirmed = window.confirm(
                    `Permanently delete “${link.label}”? This cannot be undone.`
                  );
                  if (!confirmed) return;

                  setPendingId(link.id);
                  startTransition(async () => {
                    const result = await deleteLinkAction(link.id);
                    setPendingId(null);
                    if (!result.success) {
                      toast.error(result.error);
                      return;
                    }
                    setArchived((items) =>
                      items.filter((item) => item.id !== link.id)
                    );
                    toast.message("Link deleted");
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
