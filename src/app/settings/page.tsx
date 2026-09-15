import { SettingsForm } from "@/components/settings/settings-form";
import { APP_NAME, APP_ROUTES } from "@/config/app";
import {
  getCurrentProfile,
  getCurrentUser,
  getLinksForCurrentUser,
} from "@/lib/links/queries";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const [profile, allLinks] = await Promise.all([
    getCurrentProfile(),
    getLinksForCurrentUser({ includeArchived: true }),
  ]);

  const archivedLinks = allLinks.filter((link) => Boolean(link.archived_at));

  return (
    <main className="relative min-h-dvh overflow-hidden px-6 py-10 sm:py-16">
      <div className="sky-backdrop" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              <Link
                href={APP_ROUTES.app}
                className="underline-offset-4 hover:underline"
              >
                ← Back to {APP_NAME}
              </Link>
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-800">
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Personal account preferences.
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white/70 p-6 shadow-[0_16px_50px_rgba(70,120,180,0.1)] ring-1 ring-white/80 backdrop-blur-xl sm:p-8">
          <SettingsForm
            profile={profile}
            email={user.email ?? null}
            archivedLinks={archivedLinks}
          />
        </div>
      </div>
    </main>
  );
}
