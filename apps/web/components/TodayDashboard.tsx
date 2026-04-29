"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import { msToKnots, type HourlyForecast } from "@windsiren/shared";
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
  daylightHours,
  mondayOfDate,
  weekDates,
} from "@/components/dashboard-utils";
import { HomeSpotsManager, type DashboardScope } from "@/components/HomeSpotsManager";
import { TileModal, type TileKey } from "@/components/TileModal";
import { WeekStrip, type WeekScoreEntry } from "@/components/WeekStrip";

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
  // Short summary like "min 18 kn · gust ≤ 30" — surfaced under the
  // score so the kiter can see (and tap to edit) what GO actually
  // means for them. Hidden for signed-out viewers.
  prefsSummary?: string;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
  homeSpotIds,
  prefsSummary,
}: Props) {
  // Scope override — lets the kiter flip the dashboard between "home
  // spots only" and "all NL" without unsetting their home spots. Default
  // is "personalized" because that's why they bothered to set homes.
  const [scope, setScope] = useState<DashboardScope>("personalized");
  const personalized =
    signedIn && homeSpotIds.size > 0 && scope === "personalized";
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
  const scoreAccent = dayScore >= 40;

  const bestSpot = pickBestSpot(dayItems);

  // Wind / gust averages of the *best* home spot for the selected day —
  // not averaged across every home spot. The hero answers "where could
  // I kite right now and what does it look like there?" — using the
  // single best spot is more honest than a regional mean that nobody
  // actually kites at.
  const heroWind = useMemo(
    () => (bestSpot ? averageWindAndGust([bestSpot]) : null),
    [bestSpot],
  );
  const isToday = selectedDate === todayKey;
  const dateLabel = formatDateLabel(selectedDate, isToday);

  // Per-day score map for the WeekStrip (same formula as the headline).
  const weekScores = useMemo(
    () => buildWeekScores(scopedSpotWeeks, dateKeys),
    [scopedSpotWeeks, dateKeys],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-paper-2 shadow-[0_1px_2px_rgba(11,46,63,0.04),0_8px_24px_-12px_rgba(11,46,63,0.12)]">
      {/* Hero — paper-grain card with the brand-deep accent on the
          left rail. Drives the eye to the wind / gust headline first. */}
      <div className="paper-grain relative px-6 pt-6 pb-5">
        <div className="absolute left-0 top-0 h-full w-1 bg-brand" aria-hidden />
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">
            Conditions
          </p>
          <p className="text-[11px] text-ink-mute">{dateLabel}</p>
        </div>

        {total === 0 ? (
          <p className="mt-4 text-sm text-ink-mute">No spot data right now.</p>
        ) : (
          <div className="mt-3 flex items-end gap-6">
            <div className="leading-none">
              {heroWind ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={[
                        "headline font-mono text-7xl",
                        scoreAccent ? "text-go-strong" : "text-ink",
                      ].join(" ")}
                    >
                      {heroWind.windKn}
                    </span>
                    <span className="font-mono text-3xl font-light text-ink-faint">/</span>
                    <span className="headline font-mono text-4xl text-ink-2">
                      {heroWind.gustKn}
                    </span>
                    <span className="ml-1 font-mono text-xs uppercase tracking-wider text-ink-mute">
                      kn
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                    wind speed · gusts
                  </p>
                </>
              ) : (
                <span className="font-mono text-3xl text-ink-faint">—</span>
              )}
            </div>
            <div className="flex-1 pb-1">
              {goCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTile("goSpots")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-go px-3.5 py-1.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.02] hover:bg-go-strong"
                >
                  <span className="font-mono">{goCount}</span> spot
                  {goCount === 1 ? "" : "s"} are GO!{" "}
                  <span aria-hidden>→</span>
                </button>
              ) : (
                <div className="text-sm text-ink-mute">
                  0 of {total} {personalized ? "home spots" : "spots"} GO
                </div>
              )}
              {bestSpot ? (
                <Link
                  href={`/spots/${bestSpot.spot.slug}`}
                  className="mt-2 inline-block text-sm font-medium text-brand-link hover:underline"
                >
                  {bestSpot.spot.name} · {countRideable(bestSpot)}h GO →
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {total > 0 ? (
          <>
            <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-paper-sunk">
              <div
                className={[
                  "h-full transition-all",
                  scoreAccent ? "bg-go" : "bg-no-go",
                ].join(" ")}
                style={{ width: `${dayScore}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              {signedIn ? (
                <HomeSpotsManager
                  homeSpotIds={homeSpotIds}
                  allSpots={spotWeeks.map((w) => w.spot)}
                  scope={scope}
                  onScopeChange={setScope}
                />
              ) : null}
            </div>
            {signedIn ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-[11px] text-ink-mute">
                  GO threshold:{" "}
                  <span className="font-mono text-ink-2">
                    {prefsSummary ?? "min 15 kn"}
                  </span>
                </span>
                <Link
                  href="/profile/preferences"
                  className="text-[11px] font-medium text-brand-link hover:underline"
                >
                  Edit kite preferences →
                </Link>
              </div>
            ) : null}
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

      {/* Tile grid — single-pixel gap on the border color reveals
          a hairline between cells. */}
      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
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
        <DaylightTile
          item={bestSpot}
          selectedDate={selectedDate}
          onClick={() => setActiveTile("daylight")}
        />
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
): Map<string, WeekScoreEntry> {
  const out = new Map<string, WeekScoreEntry>();
  for (const dateKey of dateKeys) {
    let goCount = 0;
    let total = 0;
    let windSum = 0;
    let windN = 0;
    for (const week of spotWeeks) {
      const day = week.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
      for (const h of daylightHours(day.hours)) {
        windSum += h.windSpeedMs;
        windN++;
      }
    }
    const score = total > 0 ? Math.round((goCount / total) * 100) : 0;
    const avgWindKn = windN > 0 ? Math.round(msToKnots(windSum / windN)) : null;
    out.set(dateKey, { score, goCount, total, avgWindKn });
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

// Mean wind + mean gust across the daylight hours of every spot in the
// (already home-scoped) day items list. Knots, rounded. Returns null
// when the union has no usable hours so the caller can render "—".
function averageWindAndGust(
  items: SpotWithVerdict[],
): { windKn: number; gustKn: number } | null {
  let windSum = 0;
  let gustSum = 0;
  let n = 0;
  for (const item of items) {
    for (const h of daylightHours(item.hours)) {
      windSum += h.windSpeedMs;
      gustSum += h.gustMs;
      n++;
    }
  }
  if (n === 0) return null;
  return {
    windKn: Math.round(msToKnots(windSum / n)),
    gustKn: Math.round(msToKnots(gustSum / n)),
  };
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

