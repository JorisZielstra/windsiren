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

const COL_WIDTH = 56; // px — wide enough for "08:00 – 10:00" wrapped on 2 lines

// Windguru-style pivoted forecast table. Rows are metrics (Wind kn,
// Gust kn, Dir, Air °C, Rain, Ride). Columns are 2-hour windows of
// the day, laid out in a single continuous strip across the entire
// fetched window (today + ~13 future days = up to 14 days). The
// first column is sticky so the row labels stay visible as the user
// scrolls right through the week.
export function WindguruDayTable({ spot, hours, windowSize = 2 }: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return <p className="text-xs text-zinc-500">No hourly data to show.</p>;
  }

  // Group buckets by their NL local date so the day header can colspan
  // each day's columns. Order is preserved (oldest → newest).
  const days: { dateKey: string; buckets: HourBucket[] }[] = [];
  let last = "";
  for (const b of buckets) {
    if (b.dateKey !== last) {
      days.push({ dateKey: b.dateKey, buckets: [b] });
      last = b.dateKey;
    } else {
      days[days.length - 1]!.buckets.push(b);
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          {/* Day row — one cell per day, spans that day's bucket columns */}
          <tr>
            <th className={`${stickyLeft} ${headerCell} align-bottom`}>Day</th>
            {days.map((d) => (
              <th
                key={d.dateKey}
                colSpan={d.buckets.length}
                className="border-b border-l border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {formatDayHeader(d.dateKey)}
              </th>
            ))}
          </tr>

          {/* Time row — one cell per bucket */}
          <tr>
            <th className={`${stickyLeft} ${headerCell}`}>Time</th>
            {buckets.map((b) => (
              <th
                key={b.startTime}
                style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                className="border-b border-zinc-200 bg-zinc-50 px-1 py-1 text-center font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>{pad2(b.startLocalHour)}:00</div>
                <div className="text-zinc-400">–</div>
                <div>{pad2((b.startLocalHour + windowSize) % 24)}:00</div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <MetricRow label="Wind kn">
            {buckets.map((b) => (
              <CellWind key={b.startTime} kn={msToKnots(b.windSpeedMs)} />
            ))}
          </MetricRow>

          <MetricRow label="Gust kn">
            {buckets.map((b) => (
              <CellNum
                key={b.startTime}
                value={Math.round(msToKnots(b.gustMs))}
                muted
              />
            ))}
          </MetricRow>

          <MetricRow label="Dir">
            {buckets.map((b) => (
              <CellDirection
                key={b.startTime}
                deg={b.windDirectionDeg}
                cardinal={cardinalDirection(b.windDirectionDeg)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Air °C">
            {buckets.map((b) => (
              <CellNum key={b.startTime} value={Math.round(b.airTempC)} />
            ))}
          </MetricRow>

          <MetricRow label="Rain">
            {buckets.map((b) => (
              <CellRain key={b.startTime} mm={b.precipitationMm} />
            ))}
          </MetricRow>

          <MetricRow label="Ride">
            {buckets.map((b) => (
              <CellRide key={b.startTime} rideable={b.rideable} />
            ))}
          </MetricRow>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows + cells
// ---------------------------------------------------------------------------

const stickyLeft =
  "sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800";
const headerCell =
  "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500";

function MetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        className={`${stickyLeft} px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-100 dark:border-zinc-900`}
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function CellWind({ kn }: { kn: number }) {
  const tint = windTint(kn);
  return (
    <td
      className={`border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-sm font-semibold dark:border-zinc-900 ${tint}`}
    >
      {Math.round(kn)}
    </td>
  );
}

function CellNum({
  value,
  muted = false,
}: {
  value: number;
  muted?: boolean;
}) {
  return (
    <td
      className={`border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-sm dark:border-zinc-900 ${
        muted ? "text-zinc-500" : ""
      }`}
    >
      {value}
    </td>
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
    <td
      title={`${cardinal} (${Math.round(deg)}°)`}
      className="border-b border-zinc-100 px-1 py-1 dark:border-zinc-900"
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <Arrow degrees={deg} />
        <span className="font-mono text-[9px] text-zinc-500">{cardinal}</span>
      </div>
    </td>
  );
}

function CellRain({ mm }: { mm: number }) {
  if (mm <= 0) {
    return (
      <td className="border-b border-zinc-100 px-1 py-1.5 text-center text-xs text-zinc-300 dark:border-zinc-900 dark:text-zinc-700">
        —
      </td>
    );
  }
  const tint =
    mm > 0.5
      ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      : "";
  return (
    <td
      className={`border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-xs dark:border-zinc-900 ${tint}`}
    >
      {mm.toFixed(1)}
    </td>
  );
}

function CellRide({ rideable }: { rideable: boolean }) {
  return (
    <td className="border-b border-zinc-100 px-1 py-1.5 dark:border-zinc-900">
      <div className="flex items-center justify-center">
        <span
          className={[
            "inline-block h-2.5 w-2.5 rounded-full",
            rideable ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700",
          ].join(" ")}
          aria-label={rideable ? "rideable" : "not rideable"}
        />
      </div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

function Arrow({ degrees }: { degrees: number }) {
  // Wind direction = "comes FROM"; downwind arrow points where the wind
  // is going.
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

const NL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// "Mo (27/4)" — pin to UTC noon so the day-of-week formatter doesn't
// roll across the NL TZ boundary at midnight.
function formatDayHeader(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const localDate = new Date(
    d.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }),
  );
  const weekday = NL_WEEKDAYS[localDate.getDay()] ?? "";
  const day = parseInt(dateKey.slice(8, 10), 10);
  const month = parseInt(dateKey.slice(5, 7), 10);
  return `${weekday} (${day}/${month})`;
}
