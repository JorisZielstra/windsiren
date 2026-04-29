"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchUsers, type UserSearchResult } from "@windsiren/core";
import { Avatar } from "@/components/Avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// Debounced people-search dropdown for the global header. Hits Supabase
// directly with the browser client — RLS already restricts the public
// columns, so no server route is needed.
export function UserSearchInput() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search: 250ms after the user stops typing.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const rows = await searchUsers(supabase, trimmed);
      setResults(rows);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-40 sm:w-56">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Find kiters…"
        aria-label="Search users"
        className="w-full rounded-md border border-border bg-paper-2 px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-brand sm:text-sm"
      />
      {showDropdown ? (
        <div className="absolute right-0 left-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-paper-2 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-ink-mute">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink-mute">No matches.</p>
          ) : (
            <ul className="py-1">
              {results.map((user) => (
                <li key={user.id}>
                  <Link
                    href={`/users/${user.id}`}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-paper-sunk"
                  >
                    <Avatar
                      url={user.avatar_url}
                      name={user.display_name}
                      size={28}
                    />
                    <span className="truncate">
                      {user.display_name ?? "Unnamed kiter"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
