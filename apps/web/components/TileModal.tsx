"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  averageDirectionDeg,
  bucketHours,
  getSunTimes,
  type FriendsOnWaterToday,
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";
export type TileKey =
  | "score"
  | "wind"
  | "airTemp"
  | "friends"
  | "peakWindow"
  | "trend"
  | "daylight"
  | "verdict"
  | "goSpots";

type Props = {
  tile: TileKey | null;
  onClose: () => void;
  // Data context — the dashboard passes its current selected-date slice.
  dayItems: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
  spotWeeks: SpotWeek[];
  selectedDate: string;
  friends: FriendsOnWaterToday;
};

export function TileModal({
  tile,
  onClose,
  dayItems,
  bestSpot,
  spotWeeks,
  selectedDate,
  friends,
}: Props) {
  // Close on ESC.
  useEffect(() => {
    if (tile === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tile, onClose]);

  if (tile === null) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border-t border-border bg-paper-2 shadow-xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl sm:border"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border bg-paper-2 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-mute">
              {labelForTile(tile)}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-ink">
              {titleForTile(tile, bestSpot)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-ink-mute hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {tile === "score" ? (
            <ScoreChart
              dayItems={dayItems}
              spotWeeks={spotWeeks}
              selectedDate={selectedDate}
            />
          ) : tile === "wind" ? (
            <WindRoseChart bestSpot={bestSpot} />
          ) : tile === "airTemp" ? (
            <HourlyLineChart
              hours={bestSpot?.hours ?? []}
              valueOf={(h) => h.airTempC}
              unit="°C"
              thresholdMin={DEFAULT_THRESHOLDS.airTempMinC}
              accent="#f97316"
            />
          ) : tile === "peakWindow" ? (
            <HourlyLineChart
              hours={bestSpot?.hours ?? []}
              valueOf={(h) => msToKnots(h.windSpeedMs)}
              gustOf={(h) => msToKnots(h.gustMs)}
              unit="kn"
              spot={bestSpot?.spot}
              shadeRideable
              accent="#10b981"
            />
          ) : tile === "trend" ? (
            <HourlyLineChart
              hours={bestSpot?.hours ?? []}
              valueOf={(h) => msToKnots(h.windSpeedMs)}
              unit="kn"
              spot={bestSpot?.spot}
              showHalfAverages
              accent="#10b981"
            />
          ) : tile === "verdict" ? (
            <HourlyLineChart
              hours={bestSpot?.hours ?? []}
              valueOf={(h) => msToKnots(h.windSpeedMs)}
              gustOf={(h) => msToKnots(h.gustMs)}
              unit="kn"
              spot={bestSpot?.spot}
              shadeRideable
              accent="#10b981"
            />
          ) : tile === "daylight" ? (
            <SunArcChart bestSpot={bestSpot} selectedDate={selectedDate} />
          ) : tile === "goSpots" ? (
            <GoSpotsList dayItems={dayItems} />
          ) : tile === "friends" ? (
            <FriendsTimeline friends={friends} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score chart — horizontal bars per spot, ranked by verdict
// ---------------------------------------------------------------------------

function ScoreChart({
  dayItems,
  spotWeeks,
  selectedDate,
}: {
  dayItems: SpotWithVerdict[];
  spotWeeks: SpotWeek[];
  selectedDate: string;
}) {
  // Per-spot bar for the selected day.
  const sorted = [...dayItems].sort((a, b) => {
    const aR = countRideable(a);
    const bR = countRideable(b);
    return bR - aR;
  });
  const max = Math.max(1, ...sorted.map((s) => countRideable(s)));

  // Tiny per-day score line for the visible week, for context.
  const weekScores = collectDateKeys(spotWeeks).map((dateKey) => {
    let goCount = 0;
    let total = 0;
    for (const w of spotWeeks) {
      const day = w.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
    }
    return { dateKey, score: total > 0 ? Math.round((goCount / total) * 100) : 0 };
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Spots by rideable hours
        </h3>
        <ul className="space-y-1.5">
          {sorted.map((item) => {
            const rideable = countRideable(item);
            const pct = (rideable / max) * 100;
            const color = colorForVerdict(item.verdict?.decision);
            return (
              <li key={item.spot.id} className="flex items-center gap-3">
                <Link
                  href={`/spots/${item.spot.slug}`}
                  className="w-32 shrink-0 truncate text-sm hover:underline"
                >
                  {item.spot.name}
                </Link>
                <div className="relative h-5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-xs text-zinc-500">
                  {rideable}h
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Score across the week
        </h3>
        <WeekScoreSpark scores={weekScores} highlight={selectedDate} />
      </div>
    </div>
  );
}

function WeekScoreSpark({
  scores,
  highlight,
}: {
  scores: { dateKey: string; score: number }[];
  highlight: string;
}) {
  const w = 480;
  const h = 90;
  const padX = 28;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = scores.length > 1 ? innerW / (scores.length - 1) : 0;
  const points = scores.map((s, i) => ({
    x: padX + i * stepX,
    y: padY + innerH * (1 - s.score / 100),
    s,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full">
      <line
        x1={padX}
        y1={padY + innerH / 2}
        x2={w - padX}
        y2={padY + innerH / 2}
        className="stroke-zinc-200 dark:stroke-zinc-800"
        strokeDasharray="2 3"
      />
      <path d={path} className="stroke-emerald-500 dark:stroke-emerald-400" fill="none" strokeWidth="2" />
      {points.map((p) => (
        <g key={p.s.dateKey}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.s.dateKey === highlight ? 5 : 3}
            className={
              p.s.dateKey === highlight
                ? "fill-emerald-500 dark:fill-emerald-400"
                : "fill-emerald-300 dark:fill-emerald-700"
            }
          />
          <text
            x={p.x}
            y={h - 4}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px]"
          >
            {weekdayShort(p.s.dateKey)}
          </text>
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            className="fill-zinc-700 font-mono text-[10px] dark:fill-zinc-300"
          >
            {p.s.score}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Wind rose — 2-hour buckets drawn as arrows, length proportional to wind kn
// ---------------------------------------------------------------------------

function WindRoseChart({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <NoData />;
  const daylight = daylightHoursOf(bestSpot.hours);
  if (daylight.length === 0) return <NoData />;
  const buckets = bucketHours(daylight, bestSpot.spot, 2);
  const avg = averageDirectionDeg(daylight.map((h) => h.windDirectionDeg));

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 24; // ring radius
  const maxKn = Math.max(
    1,
    ...buckets.map((b) => msToKnots(b.windSpeedMs)),
  );

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
      <div className="shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-72 w-72">
          {/* Compass rings */}
          {[0.33, 0.66, 1].map((t) => (
            <circle
              key={t}
              cx={cx}
              cy={cy}
              r={rOuter * t}
              fill="none"
              className="stroke-zinc-200 dark:stroke-zinc-800"
            />
          ))}
          {/* Compass labels */}
          {[
            { dir: 0, label: "N" },
            { dir: 90, label: "E" },
            { dir: 180, label: "S" },
            { dir: 270, label: "W" },
          ].map(({ dir, label }) => {
            const { x, y } = polar(cx, cy, rOuter + 12, dir);
            return (
              <text
                key={label}
                x={x}
                y={y + 3}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] font-semibold"
              >
                {label}
              </text>
            );
          })}

          {/* Per-2h arrows: length = wind speed, color = wind kn scale.
              Arrow points TOWARDS the direction the wind is coming FROM
              — meteorological convention, matching the spot-page wind
              rose needle. So a 270° (westerly) wind gets an arrow
              reaching toward W. */}
          {buckets.map((b) => {
            const kn = msToKnots(b.windSpeedMs);
            const len = (kn / maxKn) * rOuter * 0.92;
            const bearing = b.windDirectionDeg;
            const head = polar(cx, cy, len, bearing);
            const tint = windKnColor(kn);
            return (
              <g key={b.startTime}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={head.x}
                  y2={head.y}
                  stroke={tint.bg}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                {/* Arrow head — 8px triangle pointing along the bearing */}
                <ArrowHead from={polar(cx, cy, len - 6, bearing)} bearing={bearing} color={tint.bg} />
                {/* Time tick on the outer ring at the same bearing */}
                <text
                  x={polar(cx, cy, rOuter + 4, bearing).x}
                  y={polar(cx, cy, rOuter + 4, bearing).y + 3}
                  textAnchor="middle"
                  className="fill-zinc-400 text-[8px] font-mono"
                >
                  {pad2(b.startLocalHour)}h
                </text>
              </g>
            );
          })}

          {/* Centre dot + average needle */}
          <circle cx={cx} cy={cy} r={4} className="fill-zinc-700 dark:fill-zinc-300" />
        </svg>
        <div className="mt-2 text-center">
          <div className="font-mono text-xl font-bold">{cardinalDirection(avg)}</div>
          <div className="text-xs text-zinc-500">{Math.round(avg)}° avg · arrows show 2h windows</div>
        </div>
      </div>
      <div className="flex-1">
        <ul className="space-y-2">
          {buckets.map((b) => {
            const knots = Math.round(msToKnots(b.windSpeedMs));
            const tint = windKnColor(knots);
            return (
              <li
                key={b.startTime}
                className="flex items-center gap-4 rounded-lg border border-border bg-paper-2 px-4 py-2.5"
              >
                <span className="w-20 font-mono text-sm font-semibold text-ink">
                  {pad2(b.startLocalHour)}–{pad2(b.startLocalHour + 2)}h
                </span>
                <MiniRose bearing={b.windDirectionDeg} tint={tint.bg} />
                <span
                  className="ml-auto rounded-md px-3 py-1.5 font-mono text-base font-bold tabular-nums"
                  style={{ backgroundColor: tint.bg, color: tint.fg }}
                >
                  {knots} kn
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Per-row mini wind rose. Compass ring with N/E/S/W ticks and a single
// short arrow pointing TOWARDS the wind source — same convention as
// the spot-page WindRose. Replaces the "ENE 70°" text per row so the
// direction reads at a glance instead of forcing the eye through a
// degrees-to-cardinal mental conversion.
function MiniRose({ bearing, tint }: { bearing: number; tint: string }) {
  const size = 44;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const head = polar(cx, cy, rOuter * 0.85, bearing);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-11 w-11 shrink-0">
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        className="stroke-border-strong"
        strokeWidth={1}
      />
      {[0, 90, 180, 270].map((deg) => {
        const inner = polar(cx, cy, rOuter - 3, deg);
        const outer = polar(cx, cy, rOuter, deg);
        return (
          <line
            key={deg}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className="stroke-ink-faint"
            strokeWidth={1}
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={head.x}
        y2={head.y}
        stroke={tint}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <ArrowHead
        from={polar(cx, cy, rOuter * 0.85 - 5, bearing)}
        bearing={bearing}
        color={tint}
      />
      <circle cx={cx} cy={cy} r={1.5} className="fill-ink-2" />
    </svg>
  );
}

function polar(cx: number, cy: number, r: number, bearingDeg: number) {
  // 0° = N (up). Convert compass bearing to SVG angle (0° at +x axis, CW).
  const a = ((bearingDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function ArrowHead({
  from,
  bearing,
  color,
}: {
  from: { x: number; y: number };
  bearing: number;
  color: string;
}) {
  // Triangle whose tip extends 6px further along bearing.
  const tip = {
    x: from.x + 6 * Math.cos(((bearing - 90) * Math.PI) / 180),
    y: from.y + 6 * Math.sin(((bearing - 90) * Math.PI) / 180),
  };
  const left = {
    x: from.x + 4 * Math.cos((((bearing - 90) - 130) * Math.PI) / 180),
    y: from.y + 4 * Math.sin((((bearing - 90) - 130) * Math.PI) / 180),
  };
  const right = {
    x: from.x + 4 * Math.cos((((bearing - 90) + 130) * Math.PI) / 180),
    y: from.y + 4 * Math.sin((((bearing - 90) + 130) * Math.PI) / 180),
  };
  return (
    <polygon
      points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
      fill={color}
    />
  );
}

// ---------------------------------------------------------------------------
// Sun-arc chart — semicircle from sunrise to sunset with current sun marker
// ---------------------------------------------------------------------------

function SunArcChart({
  bestSpot,
  selectedDate,
}: {
  bestSpot: SpotWithVerdict | null;
  selectedDate: string;
}) {
  if (!bestSpot) return <NoData />;
  const noon = new Date(`${selectedDate}T12:00:00Z`);
  const { sunrise, sunset } = getSunTimes(bestSpot.spot.lat, bestSpot.spot.lng, noon);
  const lengthMs = sunset.getTime() - sunrise.getTime();
  const hours = Math.floor(lengthMs / 3600000);
  const minutes = Math.floor((lengthMs % 3600000) / 60000);

  // Solar noon = midpoint between sunrise and sunset.
  const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
  // Now-marker: current time clamped to [sunrise, sunset].
  const nowMs = Date.now();
  const showNow = nowMs >= sunrise.getTime() && nowMs <= sunset.getTime();

  // Layout
  const w = 560;
  const h = 240;
  const padX = 40;
  const baseY = h - 36;
  const r = (w - padX * 2) / 2;

  // f=0 at sunrise, f=1 at sunset; sin(πf) traces the arc.
  const point = (t: number) => {
    const f = (t - sunrise.getTime()) / lengthMs;
    const x = padX + f * (w - padX * 2);
    const y = baseY - Math.sin(f * Math.PI) * r;
    return { x, y };
  };

  // Build the arc as a quadratic curve from sunrise → solarNoon → sunset.
  const p0 = point(sunrise.getTime());
  const pPeak = point(solarNoon.getTime());
  const p1 = point(sunset.getTime());
  // Quadratic Bézier: control point above the noon point so the curve
  // peaks at pPeak. For a sin curve f→sin(πf)·r the visual peak is at
  // y=baseY-r so we derive the control point from that.
  const ctrlY = 2 * pPeak.y - (p0.y + p1.y) / 2;
  const arcPath = `M ${p0.x} ${p0.y} Q ${pPeak.x} ${ctrlY} ${p1.x} ${p1.y}`;

  const nowPoint = showNow ? point(nowMs) : null;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-60 w-full">
        {/* Horizon */}
        <line
          x1={padX - 10}
          y1={baseY}
          x2={w - padX + 10}
          y2={baseY}
          className="stroke-zinc-300 dark:stroke-zinc-700"
          strokeWidth={1.5}
        />
        {/* Arc */}
        <path
          d={arcPath}
          fill="none"
          className="stroke-amber-400 dark:stroke-amber-300"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Sunrise + sunset markers */}
        <circle cx={p0.x} cy={p0.y} r={5} className="fill-amber-500" />
        <circle cx={p1.x} cy={p1.y} r={5} className="fill-amber-500" />
        {/* Solar noon marker */}
        <circle cx={pPeak.x} cy={pPeak.y} r={4} className="fill-amber-300 dark:fill-amber-200" />
        {/* Now marker (sun glyph) */}
        {nowPoint ? (
          <g>
            <circle cx={nowPoint.x} cy={nowPoint.y} r={9} className="fill-amber-400" />
            <circle cx={nowPoint.x} cy={nowPoint.y} r={9} fill="none" className="stroke-amber-600" strokeWidth={1.5} />
          </g>
        ) : null}
        {/* Labels under the horizon */}
        <text
          x={p0.x}
          y={baseY + 18}
          textAnchor="middle"
          className="fill-zinc-700 font-mono text-xs dark:fill-zinc-300"
        >
          {fmtClock(sunrise)}
        </text>
        <text
          x={p0.x}
          y={baseY + 32}
          textAnchor="middle"
          className="fill-zinc-500 text-[10px]"
        >
          sunrise
        </text>
        <text
          x={p1.x}
          y={baseY + 18}
          textAnchor="middle"
          className="fill-zinc-700 font-mono text-xs dark:fill-zinc-300"
        >
          {fmtClock(sunset)}
        </text>
        <text
          x={p1.x}
          y={baseY + 32}
          textAnchor="middle"
          className="fill-zinc-500 text-[10px]"
        >
          sunset
        </text>
        <text
          x={pPeak.x}
          y={pPeak.y - 12}
          textAnchor="middle"
          className="fill-zinc-500 font-mono text-[10px]"
        >
          {fmtClock(solarNoon)}
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <Stat label="Daylight" value={`${hours}h ${minutes}m`} />
        <Stat label="Sunrise" value={fmtClock(sunrise)} />
        <Stat label="Solar noon" value={fmtClock(solarNoon)} />
        <Stat label="Sunset" value={fmtClock(sunset)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmtClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// ---------------------------------------------------------------------------
// Hourly line chart — pluggable value extractor + overlays
// ---------------------------------------------------------------------------

function HourlyLineChart({
  hours,
  valueOf,
  gustOf,
  unit,
  spot,
  thresholdMin,
  shadeRideable = false,
  showHalfAverages = false,
  accent,
}: {
  hours: HourlyForecast[];
  valueOf: (h: HourlyForecast) => number;
  gustOf?: (h: HourlyForecast) => number;
  unit: string;
  spot?: Spot;
  thresholdMin?: number;
  shadeRideable?: boolean;
  showHalfAverages?: boolean;
  accent: string;
}) {
  const daylight = daylightHoursOf(hours);
  if (daylight.length === 0) return <NoData />;

  const w = 600;
  const h = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const values = daylight.map(valueOf);
  const gusts = gustOf ? daylight.map(gustOf) : null;
  const minSrc = gusts ?? values;
  const maxSrc = gusts ?? values;
  const yMin = Math.min(...values, ...(minSrc.length ? minSrc : [0]));
  const yMax = Math.max(...values, ...(maxSrc.length ? maxSrc : [0]));
  // Add 10% padding so peaks don't hug the top.
  const yLo = Math.floor(yMin - (yMax - yMin) * 0.1);
  const yHi = Math.ceil(yMax + (yMax - yMin) * 0.1);
  const yRange = Math.max(1, yHi - yLo);
  const stepX = daylight.length > 1 ? innerW / (daylight.length - 1) : 0;

  const xy = (i: number, v: number) => ({
    x: padL + i * stepX,
    y: padT + innerH * (1 - (v - yLo) / yRange),
  });

  const linePath = values
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const gustPath = gusts
    ? gusts
        .map((v, i) => {
          const { x, y } = xy(i, v);
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ")
    : null;

  // Half-window averages (for trend tile).
  const halfAvgs = showHalfAverages ? computeHalfAvgs(values) : null;

  // Shade rideable hours (for peak window tile).
  const rideableMask =
    shadeRideable && spot
      ? daylight.map((h) => isHourRideable(h, spot, DEFAULT_THRESHOLDS))
      : null;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-60 w-full">
        {/* Y gridlines (3 ticks) */}
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * t;
          const v = Math.round(yHi - yRange * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                className="stroke-zinc-200 dark:stroke-zinc-800"
                strokeDasharray="2 3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-zinc-400 text-[9px]"
              >
                {v}
                {unit}
              </text>
            </g>
          );
        })}

        {/* Threshold line (for air-temp min) */}
        {thresholdMin !== undefined ? (
          <line
            x1={padL}
            y1={padT + innerH * (1 - (thresholdMin - yLo) / yRange)}
            x2={w - padR}
            y2={padT + innerH * (1 - (thresholdMin - yLo) / yRange)}
            className="stroke-zinc-400 dark:stroke-zinc-600"
            strokeDasharray="4 3"
          />
        ) : null}

        {/* Rideable bands */}
        {rideableMask
          ? rideableMask.map((rideable, i) => {
              if (!rideable) return null;
              const x0 = padL + (i - 0.5) * stepX;
              const x1 = padL + (i + 0.5) * stepX;
              return (
                <rect
                  key={i}
                  x={Math.max(padL, x0)}
                  y={padT}
                  width={Math.min(w - padR, x1) - Math.max(padL, x0)}
                  height={innerH}
                  className="fill-emerald-100/60 dark:fill-emerald-950/40"
                />
              );
            })
          : null}

        {/* Half-window avg lines */}
        {halfAvgs ? (
          <>
            <line
              x1={padL}
              y1={padT + innerH * (1 - (halfAvgs.first - yLo) / yRange)}
              x2={padL + innerW / 2}
              y2={padT + innerH * (1 - (halfAvgs.first - yLo) / yRange)}
              className="stroke-zinc-400 dark:stroke-zinc-600"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
            <line
              x1={padL + innerW / 2}
              y1={padT + innerH * (1 - (halfAvgs.second - yLo) / yRange)}
              x2={w - padR}
              y2={padT + innerH * (1 - (halfAvgs.second - yLo) / yRange)}
              className="stroke-zinc-400 dark:stroke-zinc-600"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />
          </>
        ) : null}

        {/* Gust line (lighter) */}
        {gustPath ? (
          <path d={gustPath} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="2" />
        ) : null}

        {/* Main value line */}
        <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />

        {/* Value points */}
        {values.map((v, i) => {
          const { x, y } = xy(i, v);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={accent} />;
        })}

        {/* X-axis hour labels (every 2-3 hrs) */}
        {daylight.map((h, i) => {
          const localHour = nlLocalHour(new Date(h.time));
          if (i !== 0 && i !== daylight.length - 1 && localHour % 3 !== 0) return null;
          return (
            <text
              key={h.time}
              x={padL + i * stepX}
              y={h.time && padT + innerH + 14}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px]"
            >
              {pad2(localHour)}h
            </text>
          );
        })}
      </svg>

      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: accent }} />
          {gustPath ? "wind" : "value"}
        </span>
        {gustPath ? (
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-0.5 w-3"
              style={{ backgroundColor: accent, opacity: 0.35 }}
            />
            gust
          </span>
        ) : null}
        {shadeRideable ? (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 bg-emerald-100 dark:bg-emerald-950" />
            rideable
          </span>
        ) : null}
        {thresholdMin !== undefined ? (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 border-t border-dashed border-zinc-400" />
            min {thresholdMin}
            {unit}
          </span>
        ) : null}
        {halfAvgs ? (
          <span className="text-zinc-500">
            avg {halfAvgs.first.toFixed(1)} → {halfAvgs.second.toFixed(1)} {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GO spots list — kiters tap "X spots are GO!" on the dashboard and
// land here. Filtered to verdict=go for the selected day, sorted by
// rideable hours so the most-promising spot floats to the top. Each
// row is a Link → /spots/[slug] with peak-wind context so the user
// can decide quickly without opening every spot page.
// ---------------------------------------------------------------------------

function GoSpotsList({ dayItems }: { dayItems: SpotWithVerdict[] }) {
  const goSpots = dayItems
    .filter((d) => d.verdict?.decision === "go")
    .map((d) => {
      const rideable = d.hours.filter((h) =>
        isHourRideable(h, d.spot, DEFAULT_THRESHOLDS),
      ).length;
      let peakWindMs = 0;
      let peakGustMs = 0;
      let peakDirDeg = 0;
      for (const h of d.hours) {
        if (h.windSpeedMs > peakWindMs) {
          peakWindMs = h.windSpeedMs;
          peakDirDeg = h.windDirectionDeg;
        }
        if (h.gustMs > peakGustMs) peakGustMs = h.gustMs;
      }
      return { item: d, rideable, peakWindMs, peakGustMs, peakDirDeg };
    })
    .sort((a, b) => b.rideable - a.rideable);

  if (goSpots.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nothing's GO right now. Tap the day strip to scan another day.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {goSpots.map(({ item, rideable, peakWindMs, peakGustMs, peakDirDeg }) => {
        const tint = windKnColor(msToKnots(peakWindMs));
        return (
          <li key={item.spot.id}>
            <Link
              href={`/spots/${item.spot.slug}`}
              className="block rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 transition-colors hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-700 dark:hover:bg-emerald-950"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{item.spot.name}</span>
                <span
                  className="rounded-md px-2 py-0.5 font-mono text-xs"
                  style={{ backgroundColor: tint.bg, color: tint.fg }}
                >
                  peak {Math.round(msToKnots(peakWindMs))} kn / {Math.round(msToKnots(peakGustMs))}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  {cardinalDirection(peakDirDeg)} ·{" "}
                  <span className="font-mono">{rideable}h GO</span>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">Open →</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Friends timeline (list, not chart)
// ---------------------------------------------------------------------------

function FriendsTimeline({ friends }: { friends: FriendsOnWaterToday }) {
  if (friends.profiles.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nobody you follow has logged a session or RSVP'd today.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {friends.profiles.map((p: PublicProfile) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
        >
          <Link
            href={`/users/${p.id}`}
            className="font-medium hover:underline"
          >
            {p.display_name ?? "Someone"}
          </Link>
          <span className="text-xs text-zinc-500">out today</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function NoData() {
  return <p className="text-sm text-zinc-500">No data for this date.</p>;
}

function colorForVerdict(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "#10b981";
  if (d === "marginal") return "#f59e0b";
  return "#a1a1aa";
}

function labelForTile(tile: TileKey): string {
  return {
    score: "Conditions score",
    wind: "Wind",
    airTemp: "Air temperature",
    friends: "Friends on the water",
    peakWindow: "Peak window",
    trend: "Wind trend",
    daylight: "Daylight",
    verdict: "Verdict",
    goSpots: "GO spots",
  }[tile];
}

function titleForTile(tile: TileKey, bestSpot: SpotWithVerdict | null): string {
  if (tile === "score") return "Score breakdown";
  const at = bestSpot ? ` · ${bestSpot.spot.name}` : "";
  if (tile === "wind") return `Wind rose${at}`;
  if (tile === "airTemp") return `Hourly temperature${at}`;
  if (tile === "peakWindow") return `Hourly wind${at}`;
  if (tile === "trend") return `Wind trend${at}`;
  if (tile === "daylight") return `Sun arc${at}`;
  if (tile === "verdict") return `Hourly wind${at}`;
  if (tile === "goSpots") return "Where it's GO";
  return "Today's friends";
}

function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

function daylightHoursOf(hours: HourlyForecast[]): HourlyForecast[] {
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

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function weekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-NL", {
    weekday: "short",
    timeZone: "Europe/Amsterdam",
  });
}

function collectDateKeys(spotWeeks: SpotWeek[]): string[] {
  const keys = new Set<string>();
  for (const w of spotWeeks) for (const d of w.days) keys.add(d.dateKey);
  return Array.from(keys).sort();
}

function computeHalfAvgs(values: number[]): { first: number; second: number } {
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  return {
    first: first.reduce((s, x) => s + x, 0) / Math.max(1, first.length),
    second: second.reduce((s, x) => s + x, 0) / Math.max(1, second.length),
  };
}
