"use client";

import { useAppState } from "@/components/app-shell/app-state";

/** Screen-reader friendly list of active links (spatial canvas is primary UI). */
export function AccessibleLinkList() {
  const { links, setSelectedLinkId } = useAppState();
  const active = links.filter((link) => !link.archived_at);

  if (active.length === 0) return null;

  return (
    <nav aria-label="Saved links" className="sr-only">
      <ul>
        {active.map((link) => (
          <li key={link.id}>
            <button type="button" onClick={() => setSelectedLinkId(link.id)}>
              {link.label} — {link.hostname}
            </button>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              Open {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
