"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRsvp, dbRowToSpot } from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type RsvpWindow = number | "all";

const WINDOW_HOURS: number[] = [6, 8, 10, 12, 14, 16, 18];

// Strava-style floating action button. Visible only when signed in
// (set `signedIn` from a server-side auth check). One tap opens a
// popover with two paths:
//   - Plan a session → opens PlanSessionModal (3-step quick RSVP)
//   - Log past session → routes to /spots (kiters drill into a spot
//     and use the existing log composer there). GPS tracking is
//     parked Future Work.
export function StartSessionFab({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  if (!signedIn) return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {open ? (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPlanOpen(true);
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900"
            >
              📅 Plan a session
            </button>
            <Link
              href="/spots"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-900"
            >
              ✏️ Log past session
            </Link>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close start menu" : "Start a session"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-go text-2xl font-bold text-white shadow-[0_4px_14px_rgba(15,184,154,0.45)] transition-transform hover:bg-go-strong hover:scale-105"
        >
          {open ? "×" : "+"}
        </button>
      </div>

      {planOpen ? (
        <PlanSessionModal onClose={() => setPlanOpen(false)} />
      ) : null}
    </>
  );
}

function PlanSessionModal({ onClose }: { onClose: () => void }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<0 | 1 | 2>(0);
  const [window, setWindow] = useState<RsvpWindow>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: dbErr } = await supabase
        .from("spots")
        .select("*")
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        return;
      }
      setSpots((data ?? []).map(dbRowToSpot));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function submit() {
    if (!spotId) {
      setError("Pick a spot first.");
      return;
    }
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError("Please sign in.");
      return;
    }
    const dateKey = dateKeyForOffset(dayOffset);
    const result = await createRsvp(
      supabase,
      user.id,
      spotId,
      dateKey,
      window === "all" ? null : window,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === "error" ? result.message : "Couldn't plan session.");
      return;
    }
    const spot = spots?.find((s) => s.id === spotId);
    onClose();
    if (spot) router.push(`/spots/${spot.slug}`);
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Plan a session
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">Where & when?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ×
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <Step label="1 · Spot">
            {spots === null ? (
              <p className="text-sm text-zinc-500">Loading spots…</p>
            ) : (
              <select
                value={spotId ?? ""}
                onChange={(e) => setSpotId(e.target.value || null)}
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="" disabled>
                  Pick a spot…
                </option>
                {spots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Step>

          <Step label="2 · Day">
            <div className="flex flex-wrap gap-1.5">
              {([0, 1, 2] as const).map((o) => (
                <Pill
                  key={o}
                  label={dayLabel(o)}
                  active={dayOffset === o}
                  onClick={() => setDayOffset(o)}
                />
              ))}
            </div>
          </Step>

          <Step label="3 · Time">
            <div className="flex flex-wrap gap-1.5">
              <Pill
                label="All day"
                active={window === "all"}
                onClick={() => setWindow("all")}
              />
              {WINDOW_HOURS.map((h) => (
                <Pill
                  key={h}
                  label={`${pad2(h)}–${pad2(h + 2)}`}
                  active={window === h}
                  onClick={() => setWindow(h)}
                />
              ))}
            </div>
          </Step>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !spotId}
            className="rounded-md bg-go px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-go-strong disabled:opacity-50"
          >
            {busy ? "Saving…" : "Plan it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const cls = active
    ? "border-go bg-go-soft text-go-ink"
    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}

function dateKeyForOffset(offset: 0 | 1 | 2): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(offset: 0 | 1 | 2): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NL", { weekday: "long" });
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
