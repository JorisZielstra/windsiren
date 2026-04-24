"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { followUser, isFollowing, unfollowUser } from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type State =
  | { kind: "loading" }
  | { kind: "self" }
  | { kind: "anon" }
  | { kind: "ready"; following: boolean; busy: boolean; message: string | null };

export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setState({ kind: "anon" });
        return;
      }
      if (user.id === targetUserId) {
        setState({ kind: "self" });
        return;
      }
      const following = await isFollowing(supabase, user.id, targetUserId);
      if (!cancelled) setState({ kind: "ready", following, busy: false, message: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, supabase]);

  if (state.kind === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />;
  }
  if (state.kind === "self") {
    return (
      <Link
        href="/profile/edit"
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
      >
        Edit profile
      </Link>
    );
  }
  if (state.kind === "anon") {
    return (
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Sign in to follow
      </Link>
    );
  }

  async function toggle() {
    if (state.kind !== "ready" || state.busy) return;
    setState({ ...state, busy: true, message: null });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState({ kind: "anon" });
      return;
    }
    const result = state.following
      ? await unfollowUser(supabase, user.id, targetUserId)
      : await followUser(supabase, user.id, targetUserId);
    if (result.ok) {
      setState({ kind: "ready", following: result.following, busy: false, message: null });
    } else {
      setState({ ...state, busy: false, message: result.message });
    }
  }

  const cls = state.following
    ? "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 border-transparent";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state.busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
      >
        {state.following ? "Following" : "Follow"}
      </button>
      {state.message ? (
        <span className="text-xs text-red-600 dark:text-red-400">{state.message}</span>
      ) : null}
    </div>
  );
}
