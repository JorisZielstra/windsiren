"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import type { HourlyForecast } from "@windsiren/shared";
import {
  AirTempTile,
  DaylightTile,
  PeakWindowTile,
  Tile,
  TrendTile,
  WindTile,
} from "@/components/DayTiles";
import {
  addDaysToKey,
  countRideable,
  mondayOfDate,
  weekDates,
} from "@/components/dashboard-utils";
import { TileModal, type TileKey } from "@/components/TileModal";
import { WeekStrip } from "@/components/WeekStrip";

type Props = {
  spotWeeks: SpotWeek[];
  todayKey: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
  // When set + non-empty, the score / kiteable count / week strip /
  // best-spot anchor all scope to these spots only. Empty set + signedIn
  // shows a "Set home spots →" prompt; signed-out viewers ignore it.
  homeSpotIds: Set<string>;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
  homeSpotIds,
}: Props) {
  // Personalized scoping: when the user has home spots set, every per-day
  // aggregate (score, kiteable count, best-spot anchor, week strip)
  // restricts to that subset. Empty home spots → fall back to all NL.
  const personalized = signedIn && homeSpotIds.size > 0;
  const scopedSpotWeeks = useMemo(
    () =>
      personalized
        ? spotWeeks.filter((w) => homeSpotIds.has(w.spot.id))
        : spotWeeks,
    [spotWeeks, homeSpotIds, personalized],
  );

  // The list of dateKeys covered by every spot's week. Sorted ascending.
  const dateKeys = useMemo(() => collectDateKeys(scopedSpotWeeks), [scopedSpotWeeks]);
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);

  // Slice each spot's week down to the selected date. Spots with no data
  // for that date get an empty hours[] + null verdict — same shape as a
  // failed fetch, so all the tile aggregations handle it identically.
  const dayItems: SpotWithVerdict[] = useMemo(
    () =>
      scopedSpotWeeks.map((week) => {
        const day = week.days.find((d) => d.dateKey === selectedDate);
        return {
          spot: week.spot,
          verdict: day?.verdict ?? null,
          hours: day?.hours ?? [],
        };
      }),
    [scopedSpotWeeks, selectedDate],
  );

  const total = dayItems.length;
  const goCount = dayItems.filter((v) => v.verdict?.decision === "go").length;
  const dayScore = total > 0 ? Math.round((goCount / total) * 100) : 0;
  const dayLabel = labelForScore(dayScore);
  const scoreAccent = dayScore >= 40;

  const bestSpot = pickBestSpot(dayItems);
  const isToday = selectedDate === todayKey;
  const dateLabel = formatDateLabel(selectedDate, isToday);

  // Per-day score map for the WeekStrip (same formula as the headline).
  const weekScores = useMemo(
    () => buildWeekScores(scopedSpotWeeks, dateKeys),
    [scopedSpotWeeks, dateKeys],
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Hero: conditions score */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Conditions score
          </p>
          <p className="text-xs text-zinc-500">{dateLabel}</p>
        </div>

        {total === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No spot data right now.</p>
        ) : (
          <div className="mt-3 flex items-end gap-6">
            <div className="leading-none">
              <span
                className={[
                  "font-mono text-6xl font-bold tracking-tight",
                  scoreAccent
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-900 dark:text-zinc-100",
                ].join(" ")}
              >
                {dayScore}
              </span>
              <span className="ml-1 text-sm text-zinc-500">/ 100</span>
            </div>
            <div className="flex-1 pb-1">
              <div className="text-lg font-semibold">{dayLabel}</div>
              <div className="mt-0.5 text-sm text-zinc-500">
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {goCount}
                </span>{" "}
                of {total} {personalized ? "home spots" : "spots"} GO
              </div>
              {bestSpot ? (
                <Link
                  href={`/spots/${bestSpot.spot.slug}`}
                  className="mt-1 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Best: {bestSpot.spot.name} · {countRideable(bestSpot)}h GO →
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {total > 0 ? (
          <>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className={[
                  "h-full",
                  scoreAccent
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : "bg-zinc-400 dark:bg-zinc-600",
                ].join(" ")}
                style={{ width: `${dayScore}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveTile("score")}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                View breakdown →
              </button>
              {signedIn && homeSpotIds.size === 0 ? (
                <p className="text-xs text-zinc-500">
                  This score covers all NL.{" "}
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Open a spot to set it as a home spot →
                  </span>
                </p>
              ) : personalized ? (
                <p className="text-xs text-zinc-500">
                  Personalized · {homeSpotIds.size} home spot
                  {homeSpotIds.size === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Week strip — Mon-Sun of the selectedDate's week, with carousel
          arrows that shift selectedDate by ±7 days clamped to the
          available data window (today + ~15 days). */}
      <WeekStrip
        visibleDates={weekDates(mondayOfDate(selectedDate))}
        weekScores={weekScores}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelect={setSelectedDate}
        onPrevWeek={
          dateKeys.length > 0 && mondayOfDate(selectedDate) > dateKeys[0]!
            ? () => {
                const target = addDaysToKey(selectedDate, -7);
                setSelectedDate(target < dateKeys[0]! ? dateKeys[0]! : target);
              }
            : undefined
        }
        onNextWeek={
          dateKeys.length > 0 &&
          addDaysToKey(mondayOfDate(selectedDate), 6) < dateKeys[dateKeys.length - 1]!
            ? () => {
                const target = addDaysToKey(selectedDate, 7);
                const last = dateKeys[dateKeys.length - 1]!;
                setSelectedDate(target > last ? last : target);
              }
            : undefined
        }
      />

      {/* Tile grid */}
      <div className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-900 dark:bg-zinc-900">
        <WindTile item={bestSpot} onClick={() => setActiveTile("wind")} />
        <AirTempTile item={bestSpot} onClick={() => setActiveTile("airTemp")} />
        {signedIn ? (
          <FriendsTile
            count={friendsCount}
            preview={friendsPreview}
            isToday={isToday}
            onClick={isToday ? () => setActiveTile("friends") : undefined}
          />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile
          dayItems={dayItems}
          item={bestSpot}
          onClick={() => setActiveTile("peakWindow")}
        />
        <DaylightTile item={bestSpot} selectedDate={selectedDate} />
        <TrendTile item={bestSpot} onClick={() => setActiveTile("trend")} />
      </div>

      <TileModal
        tile={activeTile}
        onClose={() => setActiveTile(null)}
        dayItems={dayItems}
        bestSpot={bestSpot}
        spotWeeks={spotWeeks}
        selectedDate={selectedDate}
        friends={{ count: friendsCount, profiles: friendsPreview }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiles unique to the dashboard. The per-spot tiles (Wind / AirTemp /
// PeakWindow / Daylight / Trend) live in DayTiles.tsx and are shared with
// SpotConditionsBlock.
// ---------------------------------------------------------------------------

function FriendsTile({
  count,
  preview,
  isToday,
  onClick,
}: {
  count: number;
  preview: PublicProfile[];
  isToday: boolean;
  onClick?: () => void;
}) {
  if (!isToday) {
    return (
      <Tile label="Friends" sub="today only">
        <span className="font-mono text-2xl font-bold tracking-tight text-zinc-400">
          —
        </span>
      </Tile>
    );
  }
  const names = preview.slice(0, 2).map((p) => p.display_name ?? "Someone");
  const extra = Math.max(0, count - names.length);
  return (
    <Tile label="Friends" sub="out today" onClick={onClick}>
      <span
        className={[
          "font-mono text-2xl font-bold tracking-tight",
          count > 0 ? "text-emerald-600 dark:text-emerald-400" : "",
        ].join(" ")}
      >
        {count}
      </span>
      {names.length > 0 ? (
        <div className="mt-1 truncate text-xs text-zinc-500">
          {names.join(" · ")}
          {extra > 0 ? ` +${extra}` : ""}
        </div>
      ) : null}
    </Tile>
  );
}

function SignInTile() {
  return (
    <Tile label="Friends">
      <Link
        href="/auth/sign-in"
        className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Sign in →
      </Link>
    </Tile>
  );
}

function collectDateKeys(spotWeeks: SpotWeek[]): string[] {
  const keys = new Set<string>();
  for (const w of spotWeeks) for (const d of w.days) keys.add(d.dateKey);
  return Array.from(keys).sort();
}

function buildWeekScores(
  spotWeeks: SpotWeek[],
  dateKeys: string[],
): Map<string, { score: number; goCount: number; total: number }> {
  const out = new Map<string, { score: number; goCount: number; total: number }>();
  for (const dateKey of dateKeys) {
    let goCount = 0;
    let total = 0;
    for (const week of spotWeeks) {
      const day = week.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
    }
    const score = total > 0 ? Math.round((goCount / total) * 100) : 0;
    out.set(dateKey, { score, goCount, total });
  }
  return out;
}

function pickBestSpot(items: SpotWithVerdict[]): SpotWithVerdict | null {
  if (items.length === 0) return null;
  const score = (decision: "go" | "marginal" | "no_go" | undefined): number => {
    if (decision === "go") return 3;
    if (decision === "marginal") return 2;
    if (decision === "no_go") return 1;
    return 0;
  };
  let best = items[0]!;
  let bestPeak = peakOf(best.hours);
  for (const cur of items) {
    const cScore = score(cur.verdict?.decision);
    const bScore = score(best.verdict?.decision);
    if (cScore > bScore) {
      best = cur;
      bestPeak = peakOf(cur.hours);
      continue;
    }
    if (cScore === bScore) {
      const cPeak = peakOf(cur.hours);
      if (cPeak > bestPeak) {
        best = cur;
        bestPeak = cPeak;
      }
    }
  }
  return best;
}

function peakOf(hours: HourlyForecast[]): number {
  let max = 0;
  for (const h of hours) if (h.windSpeedMs > max) max = h.windSpeedMs;
  return max;
}

function labelForScore(score: number): string {
  if (score >= 70) return "Banger day";
  if (score >= 40) return "Solid day";
  if (score >= 20) return "Pockets of action";
  return "Mellow day";
}

function formatDateLabel(dateKey: string, isToday: boolean): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const formatted = d.toLocaleDateString("en-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Europe/Amsterdam",
  });
  return isToday ? `Today · ${formatted}` : formatted;
}

