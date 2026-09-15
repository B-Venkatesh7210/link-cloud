import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { APP_ROUTES } from "@/config/app";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? APP_ROUTES.app;

  const safeNext = next.startsWith("/") ? next : APP_ROUTES.app;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      if (isLocal) {
        return redirect(`${origin}${safeNext}`);
      }

      if (forwardedHost) {
        return redirect(`https://${forwardedHost}${safeNext}`);
      }

      return redirect(`${origin}${safeNext}`);
    }
  }

  return redirect(`${APP_ROUTES.login}?error=auth`);
}
