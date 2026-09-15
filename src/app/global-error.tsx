"use client";

import { useEffect } from "react";
import Link from "next/link";
import { APP_NAME, APP_ROUTES } from "@/config/app";
import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-dvh font-sans text-slate-800">
        <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
          <div className="sky-backdrop" aria-hidden />
          <div className="relative z-10 max-w-md rounded-[1.75rem] bg-white/75 p-8 text-center shadow-lg ring-1 ring-white/80 backdrop-blur-xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {APP_NAME} hit an unexpected error. Your links are safe.
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
                render={<Link href={APP_ROUTES.home} />}
                variant="outline"
                className="rounded-xl"
              >
                Go home
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
