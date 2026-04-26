"use client";

import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type SpotWithVerdict,
  type WindTrend,
} from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import { DirectionNeedle } from "@/components/DirectionNeedle";
import {
  daylightHours,
  fmtNlClock,
  longestRideableRun,
  pad2,
} from "@/components/dashboard-utils";

// Generic tile shell. When `onClick` is provided the tile renders as a
// button — used to open the chart modal. The dashboard and the per-spot
// block share the same layout; only the data differs.
export function Tile({
  label,
  sub,
  children,
  onClick,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
      {sub ? <div className="mt-1 truncate text-xs text-zinc-500">{sub}</div> : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full bg-white p-4 text-left transition-colors hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        {inner}
      </button>
    );
  }
  return <div className="bg-white p-4 dark:bg-zinc-950">{inner}</div>;
}

// ---------------------------------------------------------------------------
// Per-spot tiles. Each takes a single SpotWithVerdict (the day's slice)
// + an optional showSpotName flag — true on the dashboard to disambiguate
// "at Wijk", false on the spot page where the spot is already context.
// ---------------------------------------------------------------------------

export function WindTile({
  item,
  onClick,
}: {
  item: SpotWithVerdict | null;
  onClick?: () => void;
}) {
  if (!item) return <Tile label="Wind">—</Tile>;
  const dirs = daylightHours(item.hours).map((h) => h.windDirectionDeg);
  if (dirs.length === 0) return <Tile label="Wind">—</Tile>;
  const avgDeg = averageDirectionDeg(dirs);
  return (
    <Tile label="Wind avg" onClick={onClick}>
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

export function AirTempTile({
  item,
  showSpotName = true,
  onClick,
}: {
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onClick?: () => void;
}) {
  if (!item) return <Tile label="Air temp">—</Tile>;
  const temps = daylightHours(item.hours)
    .map((h) => h.airTempC)
    .filter((t): t is number => t != null);
  if (temps.length === 0) return <Tile label="Air temp">—</Tile>;
  const avg = temps.reduce((s, x) => s + x, 0) / temps.length;
  const sub = showSpotName ? `at ${item.spot.name}` : undefined;
  return (
    <Tile label="Air temp" sub={sub} onClick={onClick}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {Math.round(avg)}°C
      </span>
    </Tile>
  );
}

export function PeakWindowTile({
  dayItems,
  item,
  showSpotName = true,
  onClick,
}: {
  // The set of spots considered for "strongest gust" subtitle. On the
  // dashboard this is every NL spot; on the per-spot page it's just one.
  dayItems: SpotWithVerdict[];
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onClick?: () => void;
}) {
  if (!item) return <Tile label="Peak window">—</Tile>;
  const window = longestRideableRun(item);
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
    ? showSpotName
      ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}`
      : `gust ${Math.round(msToKnots(peakGustMs))} kn`
    : undefined;
  if (!window) {
    return (
      <Tile label="Peak window" sub={sub} onClick={onClick}>
        —
      </Tile>
    );
  }
  return (
    <Tile label="Peak window" sub={sub} onClick={onClick}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {pad2(window.startHour)}–{pad2(window.endHour)}h
      </span>
    </Tile>
  );
}

export function DaylightTile({
  item,
  selectedDate,
}: {
  item: SpotWithVerdict | null;
  selectedDate: string;
}) {
  if (!item) return <Tile label="Daylight">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    item.spot.lat,
    item.spot.lng,
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

export function TrendTile({
  item,
  showSpotName = true,
  onClick,
}: {
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onClick?: () => void;
}) {
  if (!item) return <Tile label="Trend">—</Tile>;
  const trend = classifyWindTrend(item.hours);
  const arrow = trend === "rising" ? "↑" : trend === "dropping" ? "↓" : "→";
  const accent =
    trend === "rising"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "dropping"
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-700 dark:text-zinc-300";
  const sub = showSpotName ? `at ${item.spot.name}` : undefined;
  return (
    <Tile label="Trend" sub={sub} onClick={onClick}>
      <span className={`font-mono text-2xl font-bold tracking-tight ${accent}`}>
        {arrow} {labelForTrend(trend)}
      </span>
    </Tile>
  );
}

function labelForTrend(t: WindTrend): string {
  if (t === "rising") return "rising";
  if (t === "dropping") return "dropping";
  return "holding";
}
