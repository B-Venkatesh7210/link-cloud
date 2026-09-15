import { APP_NAME } from "@/config/app";

export default function AppLoading() {
  return (
    <div className="relative flex h-dvh items-center justify-center overflow-hidden">
      <div className="sky-backdrop" aria-hidden />
      <div
        className="relative z-10 flex flex-col items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-white/50" />
        <p className="text-sm text-slate-500">Loading your sky…</p>
        <span className="sr-only">{APP_NAME}</span>
      </div>
    </div>
  );
}
