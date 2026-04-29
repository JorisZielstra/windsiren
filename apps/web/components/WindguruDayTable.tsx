import { bucketHours, type HourBucket } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
  type TidePoint,
} from "@windsiren/shared";

type Props = {
  spot: Spot;
  hours: HourlyForecast[];
  windowSize?: number;
  // Optional tide events spanning the same time range. When provided
  // and non-empty, the table renders a tide curve as the bottom row.
  tideEvents?: TidePoint[];
  // When true, drop the outer rounded border — for nesting inside a
  // parent card that already owns the chrome.
  flush?: boolean;
};

const COL_WIDTH = 56; // px — wide enough for "08:00 – 10:00" wrapped on 2 lines

// Windguru-style pivoted forecast table. Rows are metrics (Wind kn,
// Gust kn, Dir, Air °C, Rain, Ride). Columns are 2-hour windows of
// the day, laid out in a single continuous strip across the entire
// fetched window (today + ~13 future days = up to 14 days). The
// first column is sticky so the row labels stay visible as the user
// scrolls right through the week.
export function WindguruDayTable({
  spot,
  hours,
  windowSize = 2,
  tideEvents,
  flush = false,
}: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return <p className="text-xs text-ink-mute">No hourly data to show.</p>;
  }

  return (
    <div className="relative">
      {/* Scroll-affordance hint on the right edge — fades the last
          ~20px on narrow viewports to suggest "swipe right for more
          hours". Hidden once the user's scrolled or on wider screens
          via opacity-style media queries would be ideal but a static
          gradient is the cheap, reliable signal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-paper-2 to-transparent sm:hidden"
      />
      <div
        className={
          flush
            ? "overflow-x-auto"
            : "overflow-x-auto rounded-md border border-border"
        }
      >
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          {/* Header — one stacked cell per bucket: day · time-window.
              Repeating the day on every column makes mid-week scrolls
              readable, especially on mobile. Day boundaries get a
              left border accent so the eye still picks them up. */}
          <tr>
            <th className={`${stickyLeft} ${headerCell} align-bottom`}>Time</th>
            {buckets.map((b, i) => {
              const dayBoundary = i > 0 && b.dateKey !== buckets[i - 1]!.dateKey;
              return (
                <th
                  key={b.startTime}
                  style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
                  className={[
                    "border-b border-zinc-200 bg-zinc-50 px-1 py-1.5 text-center dark:border-zinc-800 dark:bg-zinc-900",
                    dayBoundary
                      ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
                      : "",
                  ].join(" ")}
                >
                  <div className="text-[10px] font-semibold leading-tight text-zinc-700 dark:text-zinc-300">
                    {formatDayHeader(b.dateKey)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] leading-tight text-zinc-500">
                    <div>{pad2(b.startLocalHour)}:00</div>
                    <div className="text-zinc-400">–</div>
                    <div>{pad2((b.startLocalHour + windowSize) % 24)}:00</div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          <MetricRow label="Wind kn">
            {buckets.map((b, i) => (
              <CellKn
                key={b.startTime}
                kn={msToKnots(b.windSpeedMs)}
                bold
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Gust kn">
            {buckets.map((b, i) => (
              <CellKn
                key={b.startTime}
                kn={msToKnots(b.gustMs)}
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Dir">
            {buckets.map((b, i) => (
              <CellDirection
                key={b.startTime}
                deg={b.windDirectionDeg}
                cardinal={cardinalDirection(b.windDirectionDeg)}
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Air °C">
            {buckets.map((b, i) => (
              <CellNum
                key={b.startTime}
                value={Math.round(b.airTempC)}
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Rain">
            {buckets.map((b, i) => (
              <CellRain
                key={b.startTime}
                mm={b.precipitationMm}
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          <MetricRow label="Ride">
            {buckets.map((b, i) => (
              <CellRide
                key={b.startTime}
                rideable={b.rideable}
                dayBoundary={isDayBoundary(buckets, i)}
              />
            ))}
          </MetricRow>

          {tideEvents && tideEvents.length > 0 ? (
            <TideRow buckets={buckets} tideEvents={tideEvents} />
          ) : null}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Tide row spans every bucket column with one wide SVG so the curve
// flows continuously across day boundaries. Heights are interpolated
// between consecutive high/low events using a half-cosine — that's
// the natural shape of a tide cycle, no surprises at the extremes.
function TideRow({
  buckets,
  tideEvents,
}: {
  buckets: HourBucket[];
  tideEvents: TidePoint[];
}) {
  if (buckets.length === 0) return null;

  // Sort once; downstream code assumes ascending time.
  const events = [...tideEvents].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
  );
  if (events.length < 2) return null;

  const startTimeMs = new Date(buckets[0]!.startTime).getTime();
  // Each bucket spans `windowSize` hours. The last bucket's end is its
  // start + windowSize; we approximate with 2h here since that's our
  // default and the only value used.
  const totalHours = buckets.length * 2;
  const totalMs = totalHours * 3600 * 1000;
  const totalWidth = buckets.length * COL_WIDTH;
  const height = 56;
  const padY = 6;
  const innerH = height - padY * 2;

  // Sample heights at fixed pixel intervals across the full row.
  const samples: { x: number; height: number }[] = [];
  const SAMPLE_STEP_PX = 4;
  for (let x = 0; x <= totalWidth; x += SAMPLE_STEP_PX) {
    const t = startTimeMs + (x / totalWidth) * totalMs;
    samples.push({ x, height: tideHeightAt(events, t) });
  }

  // Normalise heights to (0, 1) inside the row.
  const heights = samples.map((s) => s.height);
  const lo = Math.min(...heights);
  const hi = Math.max(...heights);
  const range = Math.max(1, hi - lo);
  const yOf = (h: number) => padY + innerH * (1 - (h - lo) / range);

  const linePath = samples
    .map(
      (s, i) => `${i === 0 ? "M" : "L"} ${s.x.toFixed(1)} ${yOf(s.height).toFixed(1)}`,
    )
    .join(" ");
  const fillPath = `${linePath} L ${totalWidth} ${height} L 0 ${height} Z`;

  // Annotate each high/low extreme inside the visible time range.
  const visibleEvents = events.filter((e) => {
    const t = new Date(e.at).getTime();
    return t >= startTimeMs && t <= startTimeMs + totalMs;
  });

  return (
    <tr>
      <th className={`${stickyLeft} px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-100 dark:border-zinc-900`}>
        Tide
      </th>
      <td
        colSpan={buckets.length}
        className="border-b border-zinc-100 p-0 dark:border-zinc-900"
        style={{ height }}
      >
        <svg
          width={totalWidth}
          height={height}
          viewBox={`0 0 ${totalWidth} ${height}`}
          preserveAspectRatio="none"
          className="block"
        >
          <path d={fillPath} className="fill-sky-100/70 dark:fill-sky-950/40" />
          <path
            d={linePath}
            fill="none"
            strokeWidth={1.5}
            className="stroke-sky-600 dark:stroke-sky-400"
          />
          {visibleEvents.map((e) => {
            const t = new Date(e.at).getTime();
            const x = ((t - startTimeMs) / totalMs) * totalWidth;
            const y = yOf(tideHeightAt(events, t));
            const labelY = e.type === "high" ? y - 6 : y + 12;
            return (
              <g key={e.at}>
                <circle
                  cx={x}
                  cy={y}
                  r={2}
                  className="fill-sky-700 dark:fill-sky-300"
                />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-zinc-700 text-[9px] font-mono dark:fill-zinc-300"
                >
                  {fmtNlClock(new Date(e.at))}
                </text>
              </g>
            );
          })}
        </svg>
      </td>
    </tr>
  );
}

// Cosine-interpolate height between adjacent extremes. Reasonable
// approximation of a tide cycle (half-period sine wave between
// successive high+low). Outside the events range, return the nearest
// extreme's height.
function tideHeightAt(events: TidePoint[], t: number): number {
  if (events.length === 0) return 0;
  const first = events[0]!;
  const last = events[events.length - 1]!;
  if (t <= new Date(first.at).getTime()) return first.heightCm;
  if (t >= new Date(last.at).getTime()) return last.heightCm;
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i]!;
    const b = events[i + 1]!;
    const aT = new Date(a.at).getTime();
    const bT = new Date(b.at).getTime();
    if (t >= aT && t <= bT) {
      const f = (t - aT) / (bT - aT);
      // Half-cosine: starts at heightA, ends at heightB, smooth at both ends.
      return a.heightCm + (b.heightCm - a.heightCm) * (1 - Math.cos(f * Math.PI)) / 2;
    }
  }
  return last.heightCm;
}

function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function isDayBoundary(buckets: HourBucket[], i: number): boolean {
  return i > 0 && buckets[i]!.dateKey !== buckets[i - 1]!.dateKey;
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

// Renders a kn value with the shared wind-color background. Used for
// both wind and gust rows; bold flag distinguishes the primary value.
function CellKn({
  kn,
  bold = false,
  dayBoundary = false,
}: {
  kn: number;
  bold?: boolean;
  dayBoundary?: boolean;
}) {
  const { bg, fg } = windKnColor(kn);
  return (
    <td
      style={{ backgroundColor: bg, color: fg }}
      className={[
        "border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-sm dark:border-zinc-900",
        bold ? "font-semibold" : "",
        dayBoundary
          ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
          : "",
      ].join(" ")}
    >
      {Math.round(kn)}
    </td>
  );
}

function CellNum({
  value,
  muted = false,
  dayBoundary = false,
}: {
  value: number;
  muted?: boolean;
  dayBoundary?: boolean;
}) {
  return (
    <td
      className={[
        "border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-sm dark:border-zinc-900",
        muted ? "text-zinc-500" : "",
        dayBoundary
          ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
          : "",
      ].join(" ")}
    >
      {value}
    </td>
  );
}

function CellDirection({
  deg,
  cardinal,
  dayBoundary = false,
}: {
  deg: number;
  cardinal: string;
  dayBoundary?: boolean;
}) {
  return (
    <td
      title={`${cardinal} (${Math.round(deg)}°)`}
      className={[
        "border-b border-zinc-100 px-1 py-1 dark:border-zinc-900",
        dayBoundary
          ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
          : "",
      ].join(" ")}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <Arrow degrees={deg} />
        <span className="font-mono text-[9px] text-zinc-500">{cardinal}</span>
      </div>
    </td>
  );
}

function CellRain({ mm, dayBoundary = false }: { mm: number; dayBoundary?: boolean }) {
  if (mm <= 0) {
    return (
      <td
        className={[
          "border-b border-zinc-100 px-1 py-1.5 text-center text-xs text-zinc-300 dark:border-zinc-900 dark:text-zinc-700",
          dayBoundary
            ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
            : "",
        ].join(" ")}
      >
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
      className={[
        "border-b border-zinc-100 px-1 py-1.5 text-center font-mono text-xs dark:border-zinc-900",
        tint,
        dayBoundary
          ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
          : "",
      ].join(" ")}
    >
      {mm.toFixed(1)}
    </td>
  );
}

function CellRide({
  rideable,
  dayBoundary = false,
}: {
  rideable: boolean;
  dayBoundary?: boolean;
}) {
  return (
    <td
      className={[
        "border-b border-zinc-100 px-1 py-1.5 dark:border-zinc-900",
        dayBoundary
          ? "border-l-2 border-l-zinc-300 dark:border-l-zinc-700"
          : "",
      ].join(" ")}
    >
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
