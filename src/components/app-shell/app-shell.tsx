"use client";

import { AppStateProvider, useAppState } from "@/components/app-shell/app-state";
import { AppHeader } from "@/components/app-shell/app-header";
import { CanvasModeSwitch } from "@/components/app-shell/canvas-mode-switch";
import { GlobalShortcuts } from "@/components/app-shell/global-shortcuts";
import { OfflineBanner } from "@/components/app-shell/offline-banner";
import { AccessibleLinkList } from "@/components/app-shell/accessible-link-list";
import { GlobalSearch } from "@/components/search/global-search";
import { CloudCanvas } from "@/components/cloud/cloud-canvas";
import { ClustersCanvas } from "@/components/clusters/clusters-canvas";
import {
  AddLinkDialog,
  EditLinkDialog,
} from "@/components/links/add-link-dialog";
import { ImportQueueDialog } from "@/components/links/import-queue-dialog";
import { ImportSessionBootstrap } from "@/components/links/import-session-bootstrap";
import { AccentColorBackfill } from "@/components/links/accent-color-backfill";
import type { Cluster } from "@/lib/clusters/types";
import type { LinkWithTags, Profile } from "@/lib/types";

function CloudOrClusters() {
  const { canvasMode } = useAppState();
  return canvasMode === "clusters" ? <ClustersCanvas /> : <CloudCanvas />;
}

export function AppShell({
  links,
  clusters,
  profile,
  email,
}: {
  links: LinkWithTags[];
  clusters: Cluster[];
  profile: Profile | null;
  email?: string | null;
}) {
  return (
    <AppStateProvider initialLinks={links} initialClusters={clusters}>
      <div className="relative h-dvh w-full overflow-hidden">
        <div className="sky-backdrop" aria-hidden />
        <AppHeader profile={profile} email={email} />
        <CanvasModeSwitch />
        <OfflineBanner />
        <GlobalSearch />
        <AccessibleLinkList />
        <CloudOrClusters />
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
