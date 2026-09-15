"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArchivedLinksSection } from "@/components/settings/archived-links";
import { updateProfileSchema, type UpdateProfileFormValues } from "@/lib/schemas";
import { updateProfileAction, signOutAction } from "@/lib/auth/actions";
import { resetCanvasPositionsAction } from "@/lib/links/actions";
import type { LinkWithTags, Profile } from "@/lib/types";
import { APP_NAME, APP_ROUTES } from "@/config/app";
import { seedDemoLinksAction } from "@/lib/links/demo-seed";
import Link from "next/link";

export function SettingsForm({
  profile,
  email,
  archivedLinks,
}: {
  profile: Profile | null;
  email: string | null;
  archivedLinks: LinkWithTags[];
}) {
  const [pending, startTransition] = useTransition();
  const [seeding, startSeed] = useTransition();
  const [resetting, startReset] = useTransition();
  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
    },
  });

  function onSubmit(values: UpdateProfileFormValues) {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email ?? ""} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Managed by Google sign-in.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Display name</Label>
          <Input
            id="full_name"
            disabled={pending}
            {...form.register("full_name")}
          />
          {form.formState.errors.full_name ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.full_name.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="border-t border-slate-200/80 pt-6">
        <h2 className="text-base font-semibold text-slate-800">Canvas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Recalculate collision-free positions for all active links.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-10 rounded-xl"
          disabled={resetting}
          onClick={() => {
            const confirmed = window.confirm(
              "Reset all canvas positions? Your links stay — only placement changes."
            );
            if (!confirmed) return;
            startReset(async () => {
              const result = await resetCanvasPositionsAction();
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Canvas positions reset");
              window.location.href = APP_ROUTES.app;
            });
          }}
        >
          {resetting ? "Resetting…" : "Reset canvas positions"}
        </Button>
      </div>

      <ArchivedLinksSection initialArchived={archivedLinks} />

      {process.env.NODE_ENV === "development" ? (
        <div className="border-t border-slate-200/80 pt-6">
          <h2 className="text-base font-semibold text-slate-800">
            Local demo sky
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Development only — seeds ~30 sample links for layout/search testing.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-10 rounded-xl"
            disabled={seeding}
            onClick={() => {
              startSeed(async () => {
                const result = await seedDemoLinksAction();
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`Seeded ${result.data.count} demo links`);
              });
            }}
          >
            {seeding ? "Seeding…" : "Seed demo links"}
          </Button>
        </div>
      ) : null}

      <div className="border-t border-slate-200/80 pt-6 text-sm text-slate-500">
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy &amp; security
        </Link>
      </div>

      <div className="border-t border-slate-200/80 pt-6">
        <p className="text-sm text-slate-500">
          Sign out of {APP_NAME} on this device.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 rounded-xl"
          onClick={() => {
            void signOutAction();
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
