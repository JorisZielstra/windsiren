"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addHomeSpot,
  removeHomeSpot,
  SUGGESTED_HOME_SPOT_MAX,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type DashboardScope = "personalized" | "all";

// Single-trigger popover that combines two needs the dashboard had wedged
// into one read-only line:
//   1. "what's my dashboard showing?"  — current scope (home spots only
//      vs. all NL) with a one-tap toggle to flip
//   2. "manage which spots are home spots" — add/remove inline so the
//      kiter doesn't have to navigate to each spot page to pin it
//
// Click outside closes. router.refresh() runs after every mutation so the
// dashboard's spot weeks + scoped score recompute against the new set.
export function HomeSpotsManager({
  homeSpotIds,
  allSpots,
  scope,
  onScopeChange,
}: {
  homeSpotIds: Set<string>;
  allSpots: Spot[];
  scope: DashboardScope;
  onScopeChange: (next: DashboardScope) => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click + Escape so the popover doesn't trap input.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleHome(spotId: string, isHome: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to manage home spots.");
      return;
    }
    setBusyId(spotId);
    setError(null);
    const result = isHome
      ? await removeHomeSpot(supabase, user.id, spotId)
      : await addHomeSpot(supabase, user.id, spotId);
    setBusyId(null);
    if (!result.ok) {
      setError(`Couldn't update: ${result.message}`);
      return;
    }
    router.refresh();
  }

  const homeSpots = allSpots.filter((s) => homeSpotIds.has(s.id));
  const nonHomeSpots = allSpots.filter((s) => !homeSpotIds.has(s.id));
  const triggerLabel =
    scope === "personalized" && homeSpotIds.size > 0
      ? `Personalized · ${homeSpotIds.size} home spot${homeSpotIds.size === 1 ? "" : "s"}`
      : "All NL spots";

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {triggerLabel}{" "}
        <span aria-hidden className="text-zinc-400">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Scope toggle — explicit pair so the active state reads at a glance. */}
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Show on dashboard
            </p>
            <div className="flex gap-1.5">
              <ScopePill
                label="Home spots only"
                active={scope === "personalized" && homeSpotIds.size > 0}
                disabled={homeSpotIds.size === 0}
                onClick={() => onScopeChange("personalized")}
              />
              <ScopePill
                label="All NL"
                active={scope === "all" || homeSpotIds.size === 0}
                onClick={() => onScopeChange("all")}
              />
            </div>
            {homeSpotIds.size === 0 ? (
              <p className="mt-1.5 text-[10px] text-zinc-500">
                Add a home spot below to enable the personalized view.
              </p>
            ) : null}
          </div>

          {/* Current home spots */}
          {homeSpots.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Your home spots
              </p>
              <ul className="space-y-1">
                {homeSpots.map((spot) => (
                  <li
                    key={spot.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/40"
                  >
                    <span className="truncate text-sm font-medium">
                      🏠 {spot.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleHome(spot.id, true)}
                      disabled={busyId === spot.id}
                      aria-label={`Remove ${spot.name} from home spots`}
                      className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
                    >
                      {busyId === spot.id ? "…" : "×"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Add picker */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Add home spot
            </p>
            <select
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) toggleHome(id, false);
              }}
              disabled={busyId !== null}
              className="block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">
                {homeSpotIds.size >= SUGGESTED_HOME_SPOT_MAX
                  ? `Pick a spot… (${homeSpotIds.size} chosen — we suggest ≤ ${SUGGESTED_HOME_SPOT_MAX})`
                  : "Pick a spot…"}
              </option>
              {nonHomeSpots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScopePill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
