"use client";

import { useEffect } from "react";
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
import type { LinkWithTags, Profile } from "@/lib/types";

function DebugRuntimeProbe() {
  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ddc618",
      },
      body: JSON.stringify({
        sessionId: "ddc618",
        runId: "pre-fix",
        hypothesisId: "E",
        location: "app-shell.tsx:DebugRuntimeProbe",
        message: "AppShell mounted",
        data: { href: window.location.href },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const onError = (event: ErrorEvent) => {
      // #region agent log
      fetch("http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ddc618",
        },
        body: JSON.stringify({
          sessionId: "ddc618",
          runId: "pre-fix",
          hypothesisId: "E",
          location: "app-shell.tsx:window.onerror",
          message: "window error",
          data: {
            name: event.error?.name ?? "Error",
            text: String(event.message ?? "").slice(0, 300),
            source: event.filename?.slice(-80),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      // #region agent log
      fetch("http://127.0.0.1:7862/ingest/e3f614d5-48ef-46ea-98fe-f235c91961c9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "ddc618",
        },
        body: JSON.stringify({
          sessionId: "ddc618",
          runId: "pre-fix",
          hypothesisId: "E",
          location: "app-shell.tsx:unhandledrejection",
          message: "unhandled rejection",
          data: {
            reason: String(event.reason?.message ?? event.reason ?? "").slice(
              0,
              300
            ),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

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
        <DebugRuntimeProbe />
        <div className="sky-backdrop" aria-hidden />
        <AppHeader profile={profile} email={email} />
        <OfflineBanner />
        <GlobalSearch />
        <AccessibleLinkList />
        <CloudCanvas />
        <AddLinkDialog />
        <EditLinkDialog />
        <GlobalShortcuts />
      </div>
    </AppStateProvider>
  );
}
