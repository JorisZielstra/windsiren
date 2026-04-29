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
  nlLocalHour,
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
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </div>
      <div className="mt-2">{children}</div>
      {sub ? (
        <div className="mt-1.5 truncate text-[11px] text-ink-mute">{sub}</div>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative block w-full bg-paper-2 p-4 text-left transition-colors hover:bg-paper-sunk"
      >
        {inner}
        <span
          aria-hidden
          className="absolute right-3 top-3 text-[10px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
        >
          ↗
        </span>
      </button>
    );
  }
  return <div className="bg-paper-2 p-4">{inner}</div>;
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
          <div className="headline font-mono text-3xl text-ink">
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
      <span className="headline font-mono text-3xl text-ink">
        {Math.round(avg)}°C
      </span>
    </Tile>
  );
}

export function PeakWindowTile({
  // dayItems was used to surface "strongest gust at spot X" across all
  // spots. New design ditches that in favour of in-window stats for
  // *this* spot, mirroring the Conditions hero. The prop stays for
  // call-site compatibility but is unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dayItems: _dayItems = [],
  item,
  onClick,
}: {
  dayItems?: SpotWithVerdict[];
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onClick?: () => void;
}) {
  if (!item) return <Tile label="Peak window">—</Tile>;
  const window = longestRideableRun(item);
  if (!window) {
    return (
      <Tile label="Peak window" onClick={onClick}>
        —
      </Tile>
    );
  }

  // Mean wind / gust within the peak-window hours of this spot. Same
  // shape as the Conditions hero so the eye picks up the parallel.
  let windSum = 0;
  let gustSum = 0;
  let n = 0;
  for (const h of item.hours) {
    const localHour = nlLocalHour(new Date(h.time));
    if (localHour >= window.startHour && localHour < window.endHour) {
      windSum += h.windSpeedMs;
      gustSum += h.gustMs;
      n++;
    }
  }
  const windKn = n > 0 ? Math.round(msToKnots(windSum / n)) : null;
  const gustKn = n > 0 ? Math.round(msToKnots(gustSum / n)) : null;

  return (
    <Tile label="Peak window" onClick={onClick}>
      <div className="leading-none">
        <div className="headline font-mono text-2xl text-ink">
          {pad2(window.startHour)}:00 – {pad2(window.endHour)}:00
        </div>
        {windKn !== null && gustKn !== null ? (
          <>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="font-mono text-base font-bold text-ink-2">
                {windKn}
              </span>
              <span className="font-mono text-sm font-light text-ink-faint">/</span>
              <span className="font-mono text-base font-bold text-ink-2">
                {gustKn}
              </span>
              <span className="ml-1 font-mono text-[9px] uppercase tracking-wider text-ink-mute">
                kn
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-ink-mute">
              wind · gusts
            </p>
          </>
        ) : null}
      </div>
    </Tile>
  );
}

export function DaylightTile({
  item,
  selectedDate,
  onClick,
}: {
  item: SpotWithVerdict | null;
  selectedDate: string;
  onClick?: () => void;
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
    <Tile label="Daylight" sub={`${hours}h ${minutes}m`} onClick={onClick}>
      <span className="headline font-mono text-3xl text-ink">
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
      ? "text-go-strong"
      : trend === "dropping"
        ? "text-maybe"
        : "text-ink";
  const sub = showSpotName ? `at ${item.spot.name}` : undefined;
  return (
    <Tile label="Trend" sub={sub} onClick={onClick}>
      <span className={`headline font-mono text-3xl ${accent}`}>
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
