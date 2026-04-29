"use client";

import { useEffect, useState } from "react";
import { fetchPastHours } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

// Modal that shows the past N hours of wind/gust at a spot — opened from
// the "Live" panel header. Blocks the spot detail page until closed.
export function LiveHistoryModal({
  spot,
  onClose,
  hoursBack = 24,
}: {
  spot: Pick<Spot, "lat" | "lng" | "name">;
  onClose: () => void;
  hoursBack?: number;
}) {
  const [hours, setHours] = useState<HourlyForecast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchPastHours(spot, hoursBack)
      .then((h) => {
        if (!cancelled) setHours(h);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [spot, hoursBack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border-t border-border bg-paper-2 shadow-xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl sm:border"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border bg-paper-2 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-mute">
              Past {hoursBack}h
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-ink">
              Actual wind · {spot.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-ink-mute hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Couldn't load history: {error}
            </p>
          ) : hours === null ? (
            <p className="text-sm text-zinc-500">Loading past {hoursBack}h…</p>
          ) : hours.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent observations.</p>
          ) : (
            <HistoryChart hours={hours} />
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryChart({ hours }: { hours: HourlyForecast[] }) {
  const w = 600;
  const h = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const winds = hours.map((x) => msToKnots(x.windSpeedMs));
  const gusts = hours.map((x) => msToKnots(x.gustMs));
  const yMax = Math.max(1, ...gusts);
  const yLo = 0;
  const yHi = Math.ceil(yMax * 1.1);
  const yRange = Math.max(1, yHi - yLo);
  const stepX = hours.length > 1 ? innerW / (hours.length - 1) : 0;

  const xy = (i: number, v: number) => ({
    x: padL + i * stepX,
    y: padT + innerH * (1 - (v - yLo) / yRange),
  });

  const windPath = winds
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const gustPath = gusts
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const last = hours[hours.length - 1]!;
  const lastKn = msToKnots(last.windSpeedMs);
  const lastTint = windKnColor(lastKn);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-60 w-full">
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
                {v}kn
              </text>
            </g>
          );
        })}

        <path d={gustPath} fill="none" stroke="#10b981" strokeOpacity="0.35" strokeWidth={2} />
        <path d={windPath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" />
        {winds.map((v, i) => {
          const { x, y } = xy(i, v);
          return <circle key={i} cx={x} cy={y} r={2} fill="#10b981" />;
        })}

        {hours.map((entry, i) => {
          const localHour = nlLocalHour(new Date(entry.time));
          if (i !== 0 && i !== hours.length - 1 && localHour % 3 !== 0) return null;
          return (
            <text
              key={entry.time}
              x={padL + i * stepX}
              y={padT + innerH + 14}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px]"
            >
              {pad2(localHour)}h
            </text>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-emerald-500" /> wind
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-emerald-500/40" /> gust
        </span>
        <span>
          Latest{" "}
          <span
            className="rounded px-1.5 py-0.5 font-mono"
            style={{ backgroundColor: lastTint.bg, color: lastTint.fg }}
          >
            {Math.round(lastKn)} kn {cardinalDirection(last.windDirectionDeg)}
          </span>
        </span>
      </div>
    </div>
  );
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
