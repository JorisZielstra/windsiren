"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  averageDirectionDeg,
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
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";
import { DirectionNeedle } from "@/components/DirectionNeedle";

export type TileKey =
  | "score"
  | "wind"
  | "airTemp"
  | "friends"
  | "peakWindow"
  | "trend";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-6 py-4 dark:border-zinc-900">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {labelForTile(tile)}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">{titleForTile(tile, bestSpot)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {tile === "score" ? (
            <ScoreChart
              dayItems={dayItems}
              spotWeeks={spotWeeks}
              selectedDate={selectedDate}
            />
          ) : tile === "wind" ? (
            <WindPolarChart bestSpot={bestSpot} />
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
// Wind polar chart — hourly direction around a circle
// ---------------------------------------------------------------------------

function WindPolarChart({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <NoData />;
  const daylight = daylightHoursOf(bestSpot.hours);
  if (daylight.length === 0) return <NoData />;
  const avg = averageDirectionDeg(daylight.map((h) => h.windDirectionDeg));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
      <div className="shrink-0">
        <DirectionNeedle directionDeg={avg} size={180} />
        <div className="mt-2 text-center">
          <div className="font-mono text-2xl font-bold">{cardinalDirection(avg)}</div>
          <div className="text-xs text-zinc-500">{Math.round(avg)}° avg</div>
        </div>
      </div>
      <div className="flex-1">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Hourly direction
        </h3>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {daylight.map((h) => {
            const localHour = nlLocalHour(new Date(h.time));
            const knots = Math.round(msToKnots(h.windSpeedMs));
            return (
              <li key={h.time} className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-zinc-500">
                  {pad2(localHour)}:00
                </span>
                <span className="font-medium">
                  {cardinalDirection(h.windDirectionDeg)}{" "}
                  <span className="text-xs text-zinc-500">
                    {Math.round(h.windDirectionDeg)}°
                  </span>
                </span>
                <span className="font-mono text-xs text-zinc-500">{knots}kn</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
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
  }[tile];
}

function titleForTile(tile: TileKey, bestSpot: SpotWithVerdict | null): string {
  if (tile === "score") return "Score breakdown";
  const at = bestSpot ? ` · ${bestSpot.spot.name}` : "";
  if (tile === "wind") return `Hourly direction${at}`;
  if (tile === "airTemp") return `Hourly temperature${at}`;
  if (tile === "peakWindow") return `Hourly wind${at}`;
  if (tile === "trend") return `Wind trend${at}`;
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
