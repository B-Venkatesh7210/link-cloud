import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME, APP_ROUTES } from "@/config/app";

export const metadata: Metadata = {
  title: "Privacy & security",
  description: `How ${APP_NAME} handles your personal links.`,
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden px-6 py-12 sm:py-16">
      <div className="sky-backdrop" aria-hidden />
      <article className="relative z-10 mx-auto max-w-2xl rounded-[1.75rem] bg-white/75 p-6 shadow-[0_16px_50px_rgba(70,120,180,0.1)] ring-1 ring-white/80 backdrop-blur-xl sm:p-10">
        <p className="text-sm text-slate-500">
          <Link href={APP_ROUTES.home} className="underline-offset-4 hover:underline">
            ← {APP_NAME}
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-800">
          Privacy &amp; security
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Concise notes for this personal MVP. Not legal advice.
        </p>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-slate-600">
          <p>
            Links you save belong to your signed-in account. They are not public
            by default and are not shared with other users in this MVP.
          </p>
          <p>
            Google is used only for authentication. We do not store Google access
            tokens for browsing or syncing third-party services.
          </p>
          <p>
            Workspace sharing, team invites, and organization features are not
            part of this release.
          </p>
          <p>
            {APP_NAME} does not use your saved links to train AI models.
          </p>
          <p>
            When you add a public URL, we may briefly fetch its page to suggest a
            title and favicon. Private or local network addresses are blocked from
            that fetch.
          </p>
          <p>
            You can archive or permanently delete links from Settings. Signing out
            ends the session on this device.
          </p>
        </div>
      </article>
    </main>
  );
}
