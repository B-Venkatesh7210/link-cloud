import { APP_NAME } from "@/config/app";

export default function Loading() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center">
      <div className="sky-backdrop" aria-hidden />
      <div
        className="relative z-10 flex flex-col items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <div className="size-9 animate-pulse rounded-2xl bg-sky-200/70" />
        <p className="text-sm text-slate-500">Opening {APP_NAME}…</p>
      </div>
    </div>
  );
}
