"use client";

import { formatWeekdayDate } from "@/components/dashboard-utils";

type Props = {
  // Exactly 7 dateKeys to render (Mon → Sun). Caller computes them
  // from the currently-selected week's Monday + addDaysToKey.
  visibleDates: string[];
  // Per-day stats. A missing entry means we don't have forecast data
  // for that day — chip renders as a muted "—" placeholder.
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
  // Carousel — undefined means the button is hidden / disabled.
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
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
}: Props) {
  if (visibleDates.length === 0) return null;
  return (
    <div className="flex items-stretch border-t border-zinc-100 dark:border-zinc-900">
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
                  !hasData && !isSelected ? "opacity-50" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[10px] font-semibold leading-tight",
                    isSelected
                      ? "text-zinc-300 dark:text-zinc-600"
                      : isToday
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-500",
                  ].join(" ")}
                >
                  {isToday ? "Today" : formatWeekdayDate(dateKey)}
                </span>
                <span className="mt-1 font-mono text-base font-bold tabular-nums">
                  {hasData ? score : "—"}
                </span>
                <span
                  className={[
                    "mt-1 h-1 w-6 rounded-full",
                    isSelected
                      ? "bg-white/40 dark:bg-zinc-900/40"
                      : hasData
                        ? accent
                        : "bg-zinc-200 dark:bg-zinc-800",
                  ].join(" ")}
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
        "flex w-9 shrink-0 items-center justify-center text-zinc-500 transition-colors",
        disabled
          ? "opacity-30"
          : "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
      ].join(" ")}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

function scoreAccentClasses(score: number, isSelected: boolean): string {
  if (isSelected) return "";
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 40) return "bg-emerald-300 dark:bg-emerald-700";
  if (score >= 20) return "bg-amber-300 dark:bg-amber-700";
  return "bg-zinc-300 dark:bg-zinc-700";
}
