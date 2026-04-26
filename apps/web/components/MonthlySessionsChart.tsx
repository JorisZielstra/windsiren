"use client";

import { useState } from "react";
import type { MonthlySessionsBucket } from "@windsiren/core";

type Props = {
  buckets: MonthlySessionsBucket[];
};

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// Vertical bar chart of sessions per calendar month over a rolling window.
// Bar height is proportional to the busiest month in the window. Empty
// months render as a faint zinc baseline so the axis stays readable.
export function MonthlySessionsChart({ buckets }: Props) {
  const [active, setActive] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No session history yet.</p>
    );
  }

  const max = Math.max(1, ...buckets.map((b) => b.sessionCount));
  const w = 520;
  const h = 180;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const slot = innerW / buckets.length;
  const barW = Math.max(8, slot * 0.6);

  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        {/* Y-axis baseline */}
        <line
          x1={padL}
          y1={padT + innerH}
          x2={w - padR}
          y2={padT + innerH}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth="1"
        />

        {buckets.map((b, i) => {
          const cx = padL + slot * (i + 0.5);
          const barH = b.sessionCount > 0 ? Math.max(4, (b.sessionCount / max) * innerH) : 2;
          const y = padT + innerH - barH;
          const isActive = active === i;
          const isFirstOfYear = b.monthKey.endsWith("-01");
          const monthIdx = parseInt(b.monthKey.slice(5, 7), 10) - 1;
          const letter = MONTH_LETTERS[monthIdx] ?? "";
          return (
            <g key={b.monthKey}>
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={barH}
                rx="2"
                className={
                  b.sessionCount > 0
                    ? isActive
                      ? "fill-emerald-600 dark:fill-emerald-300"
                      : "fill-emerald-500 dark:fill-emerald-400"
                    : "fill-zinc-200 dark:fill-zinc-800"
                }
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                style={{ cursor: "pointer" }}
              />
              <text
                x={cx}
                y={padT + innerH + 14}
                textAnchor="middle"
                className={`fill-zinc-500 text-[10px] ${
                  isActive ? "font-semibold" : ""
                }`}
              >
                {letter}
              </text>
              {isFirstOfYear ? (
                <text
                  x={cx}
                  y={padT + innerH + 24}
                  textAnchor="middle"
                  className="fill-zinc-400 text-[8px]"
                >
                  {b.monthKey.slice(0, 4)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 min-h-[1.25rem] text-xs text-zinc-500">
        {activeBucket ? (
          <>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {formatMonth(activeBucket.monthKey)}
            </span>
            {" · "}
            <span className="font-mono">{activeBucket.sessionCount}</span>{" "}
            session{activeBucket.sessionCount === 1 ? "" : "s"}
            {activeBucket.totalMinutes > 0 ? (
              <>
                {" · "}
                {formatDuration(activeBucket.totalMinutes)}
              </>
            ) : null}
          </>
        ) : (
          <>Hover a bar to see the month.</>
        )}
      </div>
    </div>
  );
}

function formatMonth(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr ?? "0", 10);
  const month = parseInt(monthStr ?? "0", 10);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("en-NL", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
}
