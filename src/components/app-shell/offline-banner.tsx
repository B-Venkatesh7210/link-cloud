"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-[4.75rem] z-40 flex justify-center px-4 sm:top-20"
    >
      <p className="rounded-full bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow-md">
        You&apos;re offline. LinkCloud needs a connection to sync.
      </p>
    </div>
  );
}
