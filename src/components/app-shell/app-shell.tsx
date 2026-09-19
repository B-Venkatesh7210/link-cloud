"use client";

import { AppStateProvider } from "@/components/app-shell/app-state";
import { AppHeader } from "@/components/app-shell/app-header";
import { GlobalShortcuts } from "@/components/app-shell/global-shortcuts";
import { OfflineBanner } from "@/components/app-shell/offline-banner";
import { AccessibleLinkList } from "@/components/app-shell/accessible-link-list";
import { GlobalSearch } from "@/components/search/global-search";
import { CloudCanvas } from "@/components/cloud/cloud-canvas";
import {
  AddLinkDialog,
  EditLinkDialog,
} from "@/components/links/add-link-dialog";
import { ImportQueueDialog } from "@/components/links/import-queue-dialog";
import { ImportSessionBootstrap } from "@/components/links/import-session-bootstrap";
import { AccentColorBackfill } from "@/components/links/accent-color-backfill";
import type { LinkWithTags, Profile } from "@/lib/types";

export function AppShell({
  links,
  profile,
  email,
}: {
  links: LinkWithTags[];
  profile: Profile | null;
  email?: string | null;
}) {
  return (
    <AppStateProvider initialLinks={links}>
      <div className="relative h-dvh w-full overflow-hidden">
        <div className="sky-backdrop" aria-hidden />
        <AppHeader profile={profile} email={email} />
        <OfflineBanner />
        <GlobalSearch />
        <AccessibleLinkList />
        <CloudCanvas />
        <AddLinkDialog />
        <EditLinkDialog />
        <ImportQueueDialog />
        <ImportSessionBootstrap />
        <AccentColorBackfill />
        <GlobalShortcuts />
      </div>
    </AppStateProvider>
  );
}
