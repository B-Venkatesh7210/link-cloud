import Link from "next/link";
import { APP_NAME, APP_ROUTES } from "@/config/app";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div className="sky-backdrop" aria-hidden />
      <div className="relative z-10 max-w-md rounded-[1.75rem] bg-white/75 p-8 text-center shadow-lg ring-1 ring-white/80 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          That path isn&apos;t part of {APP_NAME}.
        </p>
        <Button
          render={<Link href={APP_ROUTES.home} />}
          className="mt-6 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
        >
          Go home
        </Button>
      </div>
    </main>
  );
}
