import { bucketHours, type HourBucket } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

type Props = {
  spot: Spot;
  hours: HourlyForecast[];
  windowSize?: number;
};

const COL_WIDTH = 44; // px — narrow enough to fit a full day on phones

// Windguru-style pivoted table: rows are metrics (Time, Wind, Gust, Dir,
// Temp, Rain, Ride), columns are 2-hour windows of the day. Left column
// stays sticky as the right side scrolls horizontally.
export function WindguruDayTable({ spot, hours, windowSize = 2 }: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No hourly data for this day.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex">
        {/* Sticky legend column */}
        <div className="shrink-0 border-r border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <LegendCell label="Time" />
          <LegendCell label="Wind kn" />
          <LegendCell label="Gust kn" />
          <LegendCell label="Dir" />
          <LegendCell label="Air °C" />
          <LegendCell label="Rain" />
          <LegendCell label="Ride" />
        </div>

        {/* Scrolling forecast columns */}
        <div className="flex-1 overflow-x-auto">
          <div
            className="grid grid-flow-col"
            style={{ gridAutoColumns: `${COL_WIDTH}px` }}
          >
            {buckets.map((b) => (
              <BucketColumn key={b.startTime} bucket={b} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Each column is a single bucket; rows align to the legend rows by
// matching pixel heights.
function BucketColumn({ bucket }: { bucket: HourBucket }) {
  const windKn = msToKnots(bucket.windSpeedMs);
  const gustKn = msToKnots(bucket.gustMs);
  const cardinal = cardinalDirection(bucket.windDirectionDeg);
  return (
    <div className="border-l border-zinc-100 first:border-l-0 dark:border-zinc-900">
      <CellTime hour={bucket.startLocalHour} />
      <CellWind kn={windKn} />
      <CellNum value={Math.round(gustKn)} className="text-zinc-500" />
      <CellDirection deg={bucket.windDirectionDeg} cardinal={cardinal} />
      <CellNum value={Math.round(bucket.airTempC)} />
      <CellRain mm={bucket.precipitationMm} />
      <CellRide rideable={bucket.rideable} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const ROW_H = "h-9"; // keeps every cell + its legend label vertically aligned

function LegendCell({ label }: { label: string }) {
  return (
    <div
      className={`flex ${ROW_H} items-center px-3 font-medium text-[10px] border-b border-zinc-100 last:border-b-0 dark:border-zinc-900`}
    >
      {label}
    </div>
  );
}

function CellTime({ hour }: { hour: number }) {
  return (
    <div
      className={`flex ${ROW_H} items-center justify-center border-b border-zinc-100 bg-zinc-50 font-mono text-[10px] text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900`}
    >
      {pad2(hour)}
    </div>
  );
}

function CellWind({ kn }: { kn: number }) {
  const rounded = Math.round(kn);
  const tint = windTint(kn);
  return (
    <div
      className={`flex ${ROW_H} items-center justify-center border-b border-zinc-100 font-mono text-sm font-semibold dark:border-zinc-900 ${tint}`}
    >
      {rounded}
    </div>
  );
}

function CellNum({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`flex ${ROW_H} items-center justify-center border-b border-zinc-100 font-mono text-sm dark:border-zinc-900 ${className}`}
    >
      {value}
    </div>
  );
}

function CellDirection({
  deg,
  cardinal,
}: {
  deg: number;
  cardinal: string;
}) {
  return (
    <div
      className={`flex ${ROW_H} flex-col items-center justify-center border-b border-zinc-100 dark:border-zinc-900`}
      title={`${cardinal} (${Math.round(deg)}°)`}
    >
      <Arrow degrees={deg} />
      <span className="font-mono text-[9px] text-zinc-500">{cardinal}</span>
    </div>
  );
}

function CellRain({ mm }: { mm: number }) {
  if (mm <= 0) {
    return (
      <div
        className={`flex ${ROW_H} items-center justify-center border-b border-zinc-100 text-xs text-zinc-300 dark:border-zinc-900 dark:text-zinc-700`}
      >
        —
      </div>
    );
  }
  // Light tint when noticeable rain is forecast (>0.5 mm aggregated).
  const tint = mm > 0.5 ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "";
  return (
    <div
      className={`flex ${ROW_H} items-center justify-center border-b border-zinc-100 font-mono text-xs dark:border-zinc-900 ${tint}`}
    >
      {mm.toFixed(1)}
    </div>
  );
}

function CellRide({ rideable }: { rideable: boolean }) {
  return (
    <div
      className={`flex ${ROW_H} items-center justify-center border-b last:border-b-0 border-zinc-100 dark:border-zinc-900`}
    >
      <span
        className={[
          "inline-block h-2.5 w-2.5 rounded-full",
          rideable ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
        ].join(" ")}
        aria-label={rideable ? "rideable" : "not rideable"}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

// Wind arrow points downwind (direction the wind is going TO). Matches
// Windguru convention. SVG so it scales cleanly with text-size.
function Arrow({ degrees }: { degrees: number }) {
  // Wind direction is "wind comes FROM this bearing"; downwind is +180°.
  const downwind = (degrees + 180) % 360;
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      className="text-zinc-700 dark:text-zinc-300"
      style={{ transform: `rotate(${downwind}deg)` }}
      aria-hidden
    >
      <path d="M6 1 L9.5 8 L6 6.5 L2.5 8 Z" fill="currentColor" />
    </svg>
  );
}

// Tailwind class for the wind cell background, banded by knots. Matches
// the kiteable range (~15–25 kn) being green; weaker/stronger drift to
// dim/warning colors.
function windTint(kn: number): string {
  if (kn < 8) return "bg-zinc-50 text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600";
  if (kn < 15) return "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  if (kn < 25) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
  if (kn < 35) return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300";
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
