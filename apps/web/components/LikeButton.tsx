"use client";

import Link from "next/link";
import { useState } from "react";
import { likeSession, unlikeSession } from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  sessionId: string;
  initialCount: number;
  initialLiked: boolean;
  // null = anonymous viewer
  viewerId: string | null;
};

export function LikeButton({ sessionId, initialCount, initialLiked, viewerId }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (!viewerId) {
    return (
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        title="Sign in to like"
      >
        <span>♡</span>
        <span className="font-mono">{count}</span>
      </Link>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));
    const supabase = createSupabaseBrowserClient();
    const result = wasLiked
      ? await unlikeSession(supabase, viewerId!, sessionId)
      : await likeSession(supabase, viewerId!, sessionId);
    if (!result.ok) {
      // Revert on failure
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 text-sm transition-colors disabled:opacity-50 ${
        liked
          ? "text-rose-600 dark:text-rose-400"
          : "text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"
      }`}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <span>{liked ? "♥" : "♡"}</span>
      <span className="font-mono">{count}</span>
    </button>
  );
}
