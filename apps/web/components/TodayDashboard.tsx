"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type DayVerdict,
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
  type WindTrend,
} from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
} from "@windsiren/shared";
import { DirectionNeedle } from "@/components/DirectionNeedle";

type Props = {
  spotWeeks: SpotWeek[];
  todayKey: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
}: Props) {
  // The list of dateKeys covered by every spot's week. Sorted ascending.
  const dateKeys = useMemo(() => collectDateKeys(spotWeeks), [spotWeeks]);
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );

  // Slice each spot's week down to the selected date. Spots with no data
  // for that date get an empty hours[] + null verdict — same shape as a
  // failed fetch, so all the tile aggregations handle it identically.
  const dayItems: SpotWithVerdict[] = useMemo(
    () =>
      spotWeeks.map((week) => {
        const day = week.days.find((d) => d.dateKey === selectedDate);
        return {
          spot: week.spot,
          verdict: day?.verdict ?? null,
          hours: day?.hours ?? [],
        };
      }),
    [spotWeeks, selectedDate],
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
  const weekScores = useMemo(() => buildWeekScores(spotWeeks, dateKeys), [spotWeeks, dateKeys]);

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
                of {total} spots GO
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
        ) : null}
      </div>

      {/* Week strip */}
      <WeekStrip
        dateKeys={dateKeys}
        weekScores={weekScores}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelect={setSelectedDate}
      />

      {/* Tile grid */}
      <div className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-900 dark:bg-zinc-900">
        <WindTile bestSpot={bestSpot} />
        <AirTempTile bestSpot={bestSpot} />
        {signedIn ? (
          <FriendsTile count={friendsCount} preview={friendsPreview} isToday={isToday} />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile dayItems={dayItems} bestSpot={bestSpot} />
        <DaylightTile bestSpot={bestSpot} selectedDate={selectedDate} />
        <TrendTile bestSpot={bestSpot} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

function WeekStrip({
  dateKeys,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
}: {
  dateKeys: string[];
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
}) {
  if (dateKeys.length === 0) return null;
  return (
    <div className="border-t border-zinc-100 px-3 py-3 dark:border-zinc-900">
      <div className="grid auto-cols-fr grid-flow-col gap-1">
        {dateKeys.map((dateKey) => {
          const stats = weekScores.get(dateKey);
          const score = stats?.score ?? 0;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;
          const accent = scoreAccentClasses(score, isSelected);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(dateKey)}
              className={[
                "flex flex-col items-center rounded-md px-1 py-2 text-center transition-colors",
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[10px] font-semibold uppercase tracking-wide",
                  isSelected
                    ? "text-zinc-300 dark:text-zinc-600"
                    : isToday
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500",
                ].join(" ")}
              >
                {isToday ? "Today" : weekdayShort(dateKey)}
              </span>
              <span className="mt-1 font-mono text-base font-bold tabular-nums">
                {score}
              </span>
              <span
                className={[
                  "mt-1 h-1 w-6 rounded-full",
                  isSelected ? "bg-white/40 dark:bg-zinc-900/40" : accent,
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function scoreAccentClasses(score: number, isSelected: boolean): string {
  if (isSelected) return "";
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 40) return "bg-emerald-300 dark:bg-emerald-700";
  if (score >= 20) return "bg-amber-300 dark:bg-amber-700";
  return "bg-zinc-300 dark:bg-zinc-700";
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function WindTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Wind">—</Tile>;
  const dirs = daylightHours(bestSpot.hours).map((h) => h.windDirectionDeg);
  if (dirs.length === 0) return <Tile label="Wind">—</Tile>;
  const avgDeg = averageDirectionDeg(dirs);
  return (
    <Tile label="Wind avg">
      <div className="flex items-center gap-2">
        <DirectionNeedle directionDeg={avgDeg} size={36} />
        <div className="leading-tight">
          <div className="font-mono text-2xl font-bold tracking-tight">
            {cardinalDirection(avgDeg)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            {Math.round(avgDeg)}°
          </div>
        </div>
      </div>
    </Tile>
  );
}

function AirTempTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Air temp">—</Tile>;
  const temps = daylightHours(bestSpot.hours)
    .map((h) => h.airTempC)
    .filter((t): t is number => t != null);
  if (temps.length === 0) return <Tile label="Air temp">—</Tile>;
  const avg = temps.reduce((s, x) => s + x, 0) / temps.length;
  return (
    <Tile label="Air temp" sub={`at ${bestSpot.spot.name}`}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {Math.round(avg)}°C
      </span>
    </Tile>
  );
}

function FriendsTile({
  count,
  preview,
  isToday,
}: {
  count: number;
  preview: PublicProfile[];
  isToday: boolean;
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
    <Tile label="Friends" sub="out today">
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

function PeakWindowTile({
  dayItems,
  bestSpot,
}: {
  dayItems: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
}) {
  if (!bestSpot) return <Tile label="Peak window">—</Tile>;
  const window = longestRideableRun(bestSpot);
  let peakGustMs = 0;
  let peakGustSpotName: string | null = null;
  for (const v of dayItems) {
    for (const h of v.hours) {
      if (h.gustMs > peakGustMs) {
        peakGustMs = h.gustMs;
        peakGustSpotName = v.spot.name;
      }
    }
  }
  const sub = peakGustSpotName
    ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}`
    : undefined;
  if (!window) {
    return (
      <Tile label="Peak window" sub={sub}>
        —
      </Tile>
    );
  }
  return (
    <Tile label="Peak window" sub={sub}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {pad2(window.startHour)}–{pad2(window.endHour)}h
      </span>
    </Tile>
  );
}

function DaylightTile({
  bestSpot,
  selectedDate,
}: {
  bestSpot: SpotWithVerdict | null;
  selectedDate: string;
}) {
  if (!bestSpot) return <Tile label="Daylight">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    bestSpot.spot.lat,
    bestSpot.spot.lng,
    new Date(`${selectedDate}T12:00:00Z`),
  );
  const lengthMs = sunset.getTime() - sunrise.getTime();
  const hours = Math.floor(lengthMs / 3600000);
  const minutes = Math.floor((lengthMs % 3600000) / 60000);
  return (
    <Tile label="Daylight" sub={`${hours}h ${minutes}m`}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {fmtNlClock(sunrise)} → {fmtNlClock(sunset)}
      </span>
    </Tile>
  );
}

function TrendTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Trend">—</Tile>;
  const trend = classifyWindTrend(bestSpot.hours);
  const arrow = trend === "rising" ? "↑" : trend === "dropping" ? "↓" : "→";
  const accent =
    trend === "rising"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "dropping"
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-700 dark:text-zinc-300";
  return (
    <Tile label="Trend" sub={`at ${bestSpot.spot.name}`}>
      <span className={`font-mono text-2xl font-bold tracking-tight ${accent}`}>
        {arrow} {labelForTrend(trend)}
      </span>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Building blocks + helpers
// ---------------------------------------------------------------------------

function Tile({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 dark:bg-zinc-950">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
      {sub ? <div className="mt-1 truncate text-xs text-zinc-500">{sub}</div> : null}
    </div>
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

function labelForTrend(t: WindTrend): string {
  if (t === "rising") return "rising";
  if (t === "dropping") return "dropping";
  return "holding";
}

function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

function longestRideableRun(
  item: SpotWithVerdict,
): { startHour: number; endHour: number } | null {
  const daylight = daylightHours(item.hours);
  let bestStart: number | null = null;
  let bestLen = 0;
  let curStart: number | null = null;
  let curLen = 0;
  for (const h of daylight) {
    if (isHourRideable(h, item.spot, DEFAULT_THRESHOLDS)) {
      if (curStart === null) curStart = nlLocalHour(new Date(h.time));
      curLen += 1;
    } else {
      if (curLen > bestLen && curStart !== null) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = null;
      curLen = 0;
    }
  }
  if (curLen > bestLen && curStart !== null) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestStart === null || bestLen === 0) return null;
  return { startHour: bestStart, endHour: bestStart + bestLen };
}

function daylightHours(hours: HourlyForecast[]): HourlyForecast[] {
  return hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function weekdayShort(dateKey: string): string {
  // Pin to UTC noon so the formatter doesn't roll a date across local TZ.
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d
    .toLocaleDateString("en-NL", { weekday: "short", timeZone: "Europe/Amsterdam" })
    .toUpperCase();
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

// `DayVerdict` is re-exported from @windsiren/core via SpotWeek; this import
// is here only so editors keep the type around without "unused" warnings if
// you uncomment debug code.
export type _DayVerdictType = DayVerdict;
