"use client";

import Link from "next/link";
import { useState } from "react";
import { Keyboard, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME, APP_ROUTES } from "@/config/app";
import { signOutAction } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";

function initials(name: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
  return email?.[0]?.toUpperCase() ?? "U";
}

export function AppHeader({
  profile,
  email,
}: {
  profile: Profile | null;
  email?: string | null;
}) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-5">
        <Link
          href={APP_ROUTES.app}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-xl px-1 py-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 shadow-sm ring-1 ring-sky-200/60">
            <span className="text-sm font-semibold tracking-tight">LC</span>
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight text-slate-700 sm:inline">
            {APP_NAME}
          </span>
        </Link>

        <div className="pointer-events-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-11 items-center justify-center rounded-full bg-white/55 shadow-sm ring-1 ring-white/70 backdrop-blur-md transition hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
              aria-label="Open account menu"
            >
              <Avatar size="sm">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="" />
                ) : null}
                <AvatarFallback className="bg-sky-100 text-sky-800">
                  {initials(profile?.full_name ?? null, email)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name || "Signed in"}
                </p>
                {email ? (
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<Link href={APP_ROUTES.settings} />}
                className="cursor-pointer gap-2"
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => setShortcutsOpen(true)}
              >
                <Keyboard className="size-4" />
                Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => {
                  void signOutAction();
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Fast ways to move around your sky.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex justify-between gap-4">
              <span>Focus search</span>
              <kbd className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">⌘/Ctrl K</kbd>
            </li>
            <li className="flex justify-between gap-4">
              <span>Paste URL to add</span>
              <kbd className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">⌘/Ctrl V</kbd>
            </li>
            <li className="flex justify-between gap-4">
              <span>Save link form</span>
              <kbd className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">⌘/Ctrl Enter</kbd>
            </li>
            <li className="flex justify-between gap-4">
              <span>Open top search result</span>
              <kbd className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">Enter</kbd>
            </li>
            <li className="flex justify-between gap-4">
              <span>Clear / close</span>
              <kbd className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">Esc</kbd>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
