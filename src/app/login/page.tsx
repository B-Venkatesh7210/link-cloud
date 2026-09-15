import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_DESCRIPTION, APP_NAME, APP_ROUTES, APP_TAGLINE } from "@/config/app";
import { signInWithGoogleAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(APP_ROUTES.app);
  }

  const nextPath = params.next?.startsWith("/") ? params.next : APP_ROUTES.app;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      <div className="sky-backdrop" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[2rem] bg-white/65 p-8 shadow-[0_20px_60px_rgba(70,120,180,0.12)] ring-1 ring-white/80 backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-200/70">
              <span className="text-lg font-semibold tracking-tight">LC</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
              {APP_NAME}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{APP_TAGLINE}</p>
            <p className="mt-4 max-w-sm text-pretty text-[15px] leading-relaxed text-slate-600">
              {APP_DESCRIPTION}
            </p>
          </div>

          {params.error ? (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700"
            >
              Sign-in didn&apos;t complete. Please try again.
            </p>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signInWithGoogleAction(nextPath);
            }}
          >
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            By continuing, you agree to use {APP_NAME} for your personal links.
            We only use Google for authentication — we never store your Google
            access tokens.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href={APP_ROUTES.home} className="underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42Z"
        opacity=".9"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22Z"
        opacity=".75"
      />
      <path
        fill="currentColor"
        d="M6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.3.3-1.91V7.51H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49l3.34-2.58Z"
        opacity=".6"
      />
      <path
        fill="currentColor"
        d="M12 5.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.07 7.51l3.34 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
        opacity=".8"
      />
    </svg>
  );
}
