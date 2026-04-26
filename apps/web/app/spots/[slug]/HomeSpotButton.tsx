"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addHomeSpot,
  fetchHomeSpotIds,
  isHomeSpot,
  removeHomeSpot,
  SUGGESTED_HOME_SPOT_MAX,
} from "@windsiren/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type State =
  | { kind: "loading" }
  | { kind: "anon" }
  | {
      kind: "ready";
      isHome: boolean;
      // How many home spots the user has set right now. We use it to show
      // a "you're past the suggested 1-3" hint after the 4th, but never
      // block — the cap is purely advisory.
      currentCount: number;
      busy: boolean;
      message: string | null;
    };

export function HomeSpotButton({ spotId }: { spotId: string }) {
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
      const [home, ids] = await Promise.all([
        isHomeSpot(supabase, user.id, spotId),
        fetchHomeSpotIds(supabase, user.id),
      ]);
      if (!cancelled) {
        setState({
          kind: "ready",
          isHome: home,
          currentCount: ids.size,
          busy: false,
          message: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spotId, supabase]);

  if (state.kind === "loading") {
    return <div className="h-9 w-32 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />;
  }

  if (state.kind === "anon") {
    return (
      <Link
        href="/auth/sign-in"
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
      >
        🏠 Sign in to set
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

    const result = state.isHome
      ? await removeHomeSpot(supabase, user.id, spotId)
      : await addHomeSpot(supabase, user.id, spotId);

    if (result.ok) {
      const nextCount = state.currentCount + (result.isHome ? 1 : -1);
      const message =
        result.isHome && nextCount > SUGGESTED_HOME_SPOT_MAX
          ? `${nextCount} home spots — we suggest 1–${SUGGESTED_HOME_SPOT_MAX} for a focused score.`
          : null;
      setState({
        kind: "ready",
        isHome: result.isHome,
        currentCount: nextCount,
        busy: false,
        message,
      });
    } else {
      setState({
        ...state,
        busy: false,
        message: `Couldn't update: ${result.message}`,
      });
    }
  }

  const cls = state.isHome
    ? "border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
    : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state.busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
      >
        {state.isHome ? "🏠 Home spot" : "🏠 Set as home"}
      </button>
      {state.message ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{state.message}</span>
      ) : null}
    </div>
  );
}
