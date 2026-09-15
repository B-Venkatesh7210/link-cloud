"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { APP_ROUTES } from "@/config/app";
import { updateProfileSchema } from "@/lib/schemas";
import type { ActionResult, Profile } from "@/lib/types";

async function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

export async function signInWithGoogleAction(nextPath?: string) {
  const supabase = await createClient();
  const siteUrl = await getSiteOrigin();
  const safeNext =
    nextPath && nextPath.startsWith("/") ? nextPath : APP_ROUTES.app;

  const redirectTo = `${siteUrl}${APP_ROUTES.authCallback}?next=${encodeURIComponent(safeNext)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    redirect(`${APP_ROUTES.login}?error=oauth`);
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(APP_ROUTES.login);
}

export async function updateProfileAction(input: {
  full_name?: string | null;
}): Promise<ActionResult<Profile>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      code: "VALIDATION",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: parsed.data.full_name ?? null,
      avatar_url:
        (user.user_metadata?.avatar_url as string | undefined) ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "Couldn't update your profile. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidatePath(APP_ROUTES.settings);
  revalidatePath(APP_ROUTES.app);
  return { success: true, data: data as Profile };
}
