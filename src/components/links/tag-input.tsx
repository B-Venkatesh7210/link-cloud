"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder = "Add tags…",
  disabled,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");

  const commit = useCallback(
    (raw: string) => {
      const next = raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      if (next.length === 0) return;

      const merged = [...value];
      for (const tag of next) {
        if (
          !merged.some((existing) => existing.toLowerCase() === tag.toLowerCase())
        ) {
          merged.push(tag);
        }
      }
      onChange(merged);
      setDraft("");
    },
    [onChange, value]
  );

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter(
        (name) =>
          !value.some((v) => v.toLowerCase() === name.toLowerCase()) &&
          (!q || name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [draft, suggestions, value]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }

    if (event.key === "Enter") {
      if (draft.trim()) {
        event.preventDefault();
        commit(draft);
      }
      // empty draft: allow parent form submit
      return;
    }

    if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-transparent px-2.5 py-1.5 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "opacity-50"
        )}
      >
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 rounded-lg bg-sky-50 px-2 py-1 text-sky-800 hover:bg-sky-50"
          >
            {tag}
            <button
              type="button"
              disabled={disabled}
              className="rounded-sm text-sky-500 transition hover:text-sky-800"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length === 0 ? placeholder : "Add another…"}
          className="h-8 min-w-[8rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>

      {filteredSuggestions.length > 0 && draft.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {filteredSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(name)}
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 transition hover:bg-sky-50 hover:text-sky-800"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
