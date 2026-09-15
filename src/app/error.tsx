"use client";

import { useEffect } from "react";
import Link from "next/link";
import { APP_ROUTES } from "@/config/app";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div className="sky-backdrop" aria-hidden />
      <div className="relative z-10 max-w-md rounded-[1.75rem] bg-white/75 p-8 text-center shadow-lg ring-1 ring-white/80 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Please try again. If it keeps happening, return to your sky.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={reset}
          >
            Try again
          </Button>
          <Button
            render={<Link href={APP_ROUTES.app} />}
            variant="outline"
            className="rounded-xl"
          >
            Open app
          </Button>
        </div>
      </div>
    </main>
  );
}
