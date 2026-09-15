import Link from "next/link";
import { redirect } from "next/navigation";
import {
  APP_HERO,
  APP_NAME,
  APP_ROUTES,
  APP_SUPPORTING,
} from "@/config/app";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(APP_ROUTES.app);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="sky-backdrop" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col px-6 pb-16 pt-8">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-200/60">
              <span className="text-sm font-semibold">LC</span>
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-700">
              {APP_NAME}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              render={<Link href={APP_ROUTES.privacy} />}
              variant="ghost"
              className="rounded-xl text-slate-500"
            >
              Privacy
            </Button>
            <Button
              render={<Link href={APP_ROUTES.login} />}
              variant="ghost"
              className="rounded-xl"
            >
              Sign in
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-800 sm:text-5xl md:text-6xl">
            {APP_HERO}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-500 sm:text-lg">
            {APP_SUPPORTING}
          </p>
          <div className="mt-10">
            <Button
              render={<Link href={APP_ROUTES.login} />}
              size="lg"
              className="h-12 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
            >
              Continue with Google
            </Button>
          </div>

          <div
            aria-hidden
            className="relative mt-16 h-44 w-full max-w-2xl"
          >
            <div className="absolute left-[8%] top-6 h-16 w-36 rotate-[-6deg] rounded-[1.4rem] border border-white/60 bg-white/45 shadow-sm" />
            <div className="absolute right-[10%] top-2 h-16 w-40 rotate-[5deg] rounded-[1.4rem] border border-white/60 bg-white/55 shadow-sm" />
            <div className="absolute bottom-2 left-1/2 h-16 w-44 -translate-x-1/2 rounded-[1.5rem] border border-white/70 bg-white/70 shadow-md" />
          </div>
        </section>
      </div>
    </main>
  );
}
