"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  countRsvpsPerDay,
  createRsvp,
  createSession,
  deleteRsvp,
  getLikeCounts,
  getLikedSessionIds,
  getPublicProfiles,
  isUserRsvpdForDay,
  listSessionsForSpot,
  type PublicProfile,
} from "@windsiren/core";
import type { SessionRow } from "@windsiren/supabase";
import { LikeButton } from "@/components/LikeButton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  spotId: string;
};

type DayOffset = 0 | 1 | 2;

// YYYY-MM-DD for now-local + N days.
function dateKeyForOffset(offset: DayOffset): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(offset: DayOffset): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NL", { weekday: "long" });
}

export function SpotSocial({ spotId }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myRsvpByDate, setMyRsvpByDate] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [showComposer, setShowComposer] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const today = dateKeyForOffset(0);
    const twoDays = dateKeyForOffset(2);

    const [sessionsList, dayCounts] = await Promise.all([
      listSessionsForSpot(supabase, spotId, 10),
      countRsvpsPerDay(supabase, spotId, today, twoDays),
    ]);
    setSessions(sessionsList);
    setCounts(dayCounts);

    // Profile lookup for session authors + like state for the listed sessions
    const authorIds = Array.from(new Set(sessionsList.map((s) => s.user_id)));
    const sessionIds = sessionsList.map((s) => s.id);
    const [authorProfiles, sessionLikeCounts, viewerLikedIds] = await Promise.all([
      getPublicProfiles(supabase, authorIds),
      getLikeCounts(supabase, sessionIds),
      user ? getLikedSessionIds(supabase, user.id, sessionIds) : Promise.resolve(new Set<string>()),
    ]);
    setProfiles(authorProfiles);
    setLikeCounts(sessionLikeCounts);
    setLikedIds(viewerLikedIds);

    // My RSVP state for each day
    if (user) {
      const checks = await Promise.all(
        ([0, 1, 2] as DayOffset[]).map((o) =>
          isUserRsvpdForDay(supabase, user.id, spotId, dateKeyForOffset(o)).then((v) => [
            dateKeyForOffset(o),
            v,
          ] as const),
        ),
      );
      setMyRsvpByDate(Object.fromEntries(checks));
    } else {
      setMyRsvpByDate({});
    }

    setLoading(false);
  }, [spotId, supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleRsvp(offset: DayOffset) {
    if (!userId) return;
    const dateKey = dateKeyForOffset(offset);
    const already = myRsvpByDate[dateKey];
    if (already) {
      await deleteRsvp(supabase, userId, spotId, dateKey);
    } else {
      await createRsvp(supabase, userId, spotId, dateKey);
    }
    refresh();
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Spot activity
        </h2>
        {userId ? (
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
          >
            + Log session
          </button>
        ) : (
          <Link
            href="/auth/sign-in"
            className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
          >
            Sign in to post
          </Link>
        )}
      </div>

      {/* RSVP row */}
      <div className="mb-6">
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">I&apos;m going</p>
        <div className="grid grid-cols-3 gap-2">
          {([0, 1, 2] as DayOffset[]).map((offset) => {
            const dateKey = dateKeyForOffset(offset);
            const count = counts[dateKey] ?? 0;
            const mine = myRsvpByDate[dateKey];
            const disabled = !userId;
            return (
              <button
                key={offset}
                type="button"
                onClick={() => (userId ? toggleRsvp(offset) : null)}
                disabled={disabled}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  mine
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="font-medium">{dayLabel(offset)}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {count} kiter{count === 1 ? "" : "s"} going
                </div>
              </button>
            );
          })}
        </div>
        {!userId ? (
          <p className="mt-2 text-xs text-zinc-500">
            <Link href="/auth/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to RSVP.
          </p>
        ) : null}
      </div>

      {/* Recent sessions */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Recent sessions</p>
        {loading ? (
          <div className="h-10 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nobody has logged a session here yet. Be the first.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const author = profiles.get(s.user_id);
              return (
                <li
                  key={s.id}
                  className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/users/${s.user_id}`}
                      className="font-medium hover:underline"
                    >
                      {author?.display_name ?? "Someone"}
                    </Link>
                    <div className="text-sm text-zinc-500">{s.duration_minutes} min</div>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {new Date(s.session_date).toLocaleDateString("en-NL", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {s.notes ? (
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{s.notes}</p>
                  ) : null}
                  <div className="mt-2">
                    <LikeButton
                      sessionId={s.id}
                      initialCount={likeCounts.get(s.id) ?? 0}
                      initialLiked={likedIds.has(s.id)}
                      viewerId={userId}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showComposer && userId ? (
        <SessionComposer
          spotId={spotId}
          userId={userId}
          onClose={() => setShowComposer(false)}
          onCreated={() => {
            setShowComposer(false);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function SessionComposer({
  spotId,
  userId,
  onClose,
  onCreated,
}: {
  spotId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [date, setDate] = useState(dateKeyForOffset(0));
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const mins = parseInt(duration, 10);
    const result = await createSession(supabase, {
      userId,
      spotId,
      sessionDate: date,
      durationMinutes: mins,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-950"
      >
        <h3 className="text-lg font-semibold">Log session</h3>
        <p className="mt-1 text-xs text-zinc-500">Text-only for now. Photos soon.</p>

        <label className="mt-5 block">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={dateKeyForOffset(0)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Duration (minutes)</span>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min={1}
            max={1439}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="How was it?"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
}
