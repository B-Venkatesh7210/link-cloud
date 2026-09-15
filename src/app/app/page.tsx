import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { APP_ROUTES } from "@/config/app";
import {
  getCurrentProfile,
  getCurrentUser,
  getLinksForCurrentUser,
} from "@/lib/links/queries";

export default async function AppPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(APP_ROUTES.login);
  }

  const [profile, links] = await Promise.all([
    getCurrentProfile(),
    getLinksForCurrentUser(),
  ]);

  return (
    <AppShell links={links} profile={profile} email={user.email} />
  );
}
