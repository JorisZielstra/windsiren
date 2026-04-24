"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addFavorite,
  isSpotFavorited,
  removeFavorite,
} from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type State =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "ready"; favorited: boolean; busy: boolean; message: string | null };

export function FavoriteButton({ spotId }: { spotId: string }) {
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
      const favorited = await isSpotFavorited(supabase, user.id, spotId);
      if (!cancelled) {
        setState({ kind: "ready", favorited, busy: false, message: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spotId, supabase]);

  if (state.kind === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />;
  }

  if (state.kind === "anon") {
    return (
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
      >
        ☆ Sign in to favorite
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

    const result = state.favorited
      ? await removeFavorite(supabase, user.id, spotId)
      : await addFavorite(supabase, user.id, spotId);

    if (result.ok) {
      setState({ kind: "ready", favorited: result.favorited, busy: false, message: null });
    } else if (result.reason === "limit_reached") {
      setState({
        kind: "ready",
        favorited: state.favorited,
        busy: false,
        message: "Free plan: 1 favorite. Multi-spot favorites coming soon.",
      });
    } else {
      setState({
        kind: "ready",
        favorited: state.favorited,
        busy: false,
        message: `Couldn't update: ${result.message}`,
      });
    }
  }

  const cls = state.favorited
    ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state.busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
      >
        {state.favorited ? "★ Favorited" : "☆ Favorite"}
      </button>
      {state.message ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{state.message}</span>
      ) : null}
    </div>
  );
}
