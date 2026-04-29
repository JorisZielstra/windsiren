"use client";

import { windKnColor } from "@windsiren/shared";
import { formatWeekdayDate } from "@/components/dashboard-utils";

export type WeekScoreEntry = {
  score: number;
  goCount: number;
  total: number;
  // Average wind speed (knots) over the day's daylight hours, used to
  // color the bar under each chip via the same Windguru palette as the
  // forecast table. Null when we don't have hourly data for the day.
  avgWindKn: number | null;
};

type Props = {
  // Exactly 7 dateKeys to render (Mon → Sun). Caller computes them
  // from the currently-selected week's Monday + addDaysToKey.
  visibleDates: string[];
  // Per-day stats. A missing entry means we don't have forecast data
  // for that day — chip renders as a muted "—" placeholder.
  weekScores: Map<string, WeekScoreEntry>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
  // Carousel — undefined means the button is hidden / disabled.
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  // What number to render under the weekday label.
  //   "score" — 0–100 % GO out of total (per-spot rideable-hours view)
  //   "count" — raw count of GO spots (dashboard view, where a few GO
  //             out of 64 rounds to 0% and looks broken)
  // The total stays accessible via the chip's tooltip / hero copy.
  display?: "score" | "count";
};

// Mon → Sun chip strip with optional prev/next carousel arrows. The
// arrows shift the visible week by 7 days within the parent's data
// window; days outside the data window render muted.
export function WeekStrip({
  visibleDates,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
  onPrevWeek,
  onNextWeek,
  display = "score",
}: Props) {
  if (visibleDates.length === 0) return null;
  return (
    <div className="flex items-stretch border-t border-border bg-paper">
      <CarouselButton
        direction="prev"
        onClick={onPrevWeek}
        disabled={!onPrevWeek}
      />
      <div className="flex-1 px-1 py-3">
        <div className="grid auto-cols-fr grid-flow-col gap-1">
          {visibleDates.map((dateKey) => {
            const stats = weekScores.get(dateKey);
            const hasData = stats !== undefined;
            const value =
              display === "count"
                ? (stats?.goCount ?? 0)
                : (stats?.score ?? 0);
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayKey;
            // Bar color: Windguru wind palette when we have wind data,
            // selected-state white otherwise. Falls back to a neutral
            // grey for days with no forecast at all.
            const barTint =
              !isSelected && hasData && stats!.avgWindKn !== null
                ? windKnColor(stats!.avgWindKn)
                : null;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelect(dateKey)}
                className={[
                  "flex flex-col items-center rounded-lg px-1 py-2 text-center transition-all",
                  isSelected
                    ? "bg-brand text-white shadow-sm"
                    : "hover:bg-paper-sunk",
                  !hasData && !isSelected ? "opacity-50" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[10px] font-bold uppercase leading-tight tracking-[0.1em]",
                    isSelected
                      ? "text-white/70"
                      : isToday
                        ? "text-go-strong"
                        : "text-ink-mute",
                  ].join(" ")}
                >
                  {isToday ? "Today" : formatWeekdayDate(dateKey)}
                </span>
                <span className="headline mt-1 font-mono text-lg tabular-nums">
                  {hasData ? value : "—"}
                </span>
                {display === "count" && hasData && stats!.total > 1 ? (
                  <span
                    className={[
                      "mt-0.5 font-mono text-[9px] leading-none tracking-wider",
                      isSelected ? "text-white/60" : "text-ink-faint",
                    ].join(" ")}
                  >
                    of {stats!.total} GO
                  </span>
                ) : null}
                <span
                  className={[
                    "mt-1 h-1 w-6 rounded-full",
                    isSelected
                      ? "bg-white/40"
                      : barTint
                        ? ""
                        : "bg-border-strong",
                  ].join(" ")}
                  style={barTint ? { backgroundColor: barTint.bg } : undefined}
                />
              </button>
            );
          })}
        </div>
      </div>
      <CarouselButton
        direction="next"
        onClick={onNextWeek}
        disabled={!onNextWeek}
      />
    </div>
  );
}

function CarouselButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick?: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous week" : "Next week"}
      className={[
        "flex w-9 shrink-0 items-center justify-center text-lg text-ink-mute transition-colors",
        disabled ? "opacity-30" : "hover:bg-paper-sunk hover:text-ink",
      ].join(" ")}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

