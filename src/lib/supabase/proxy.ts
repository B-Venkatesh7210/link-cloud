import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_ROUTES } from "@/config/app";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute =
    pathname.startsWith(APP_ROUTES.app) || pathname.startsWith(APP_ROUTES.settings);

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = APP_ROUTES.login;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === APP_ROUTES.login) {
    const url = request.nextUrl.clone();
    url.pathname = APP_ROUTES.app;
    return NextResponse.redirect(url);
  }

  if (user && pathname === APP_ROUTES.home) {
    const url = request.nextUrl.clone();
    url.pathname = APP_ROUTES.app;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
