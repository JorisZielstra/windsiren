import { needleEndpoint } from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";

type Size = "card" | "detail";

type Props = {
  session: Pick<
    SessionRow,
    "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms" | "duration_minutes"
  >;
  size?: Size;
};

// Hero block: avg kn (accent) · gust kn · direction needle · duration min.
// Falls back to a duration-only strip when the session has no wind data
// (e.g. backdated sessions). Two sizes:
//   "card"   — feed/spot/profile list rendering (3xl numbers, 44px needle)
//   "detail" — session detail page (5xl numbers, 64px needle, more padding)
export function SessionWindHero({ session, size = "card" }: Props) {
  const dur = session.duration_minutes;
  const numClass =
    size === "detail" ? "text-5xl" : "text-3xl";
  const padding = size === "detail" ? "pb-6" : "pb-3";
  const needleSize = size === "detail" ? 64 : 44;

  if (session.wind_avg_ms == null) {
    return (
      <div className={`mt-3 flex items-baseline gap-2 px-4 ${padding}`}>
        <span className={`font-mono font-bold tracking-tight ${numClass}`}>{dur}</span>
        <span className="text-sm text-zinc-500">min</span>
        <span className="ml-auto text-xs text-zinc-400">no wind data</span>
      </div>
    );
  }
  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;
  const dirDeg = session.wind_dir_avg_deg ?? null;
  const dirLabel = dirDeg != null ? cardinalDirection(dirDeg) : null;

  return (
    <div
      className={`mt-3 grid grid-cols-[auto_auto_auto_1fr] items-end gap-x-6 gap-y-1 px-4 ${padding}`}
    >
      <Stat value={avgKn} unit="kn" label="avg" accent numClass={numClass} />
      {gustKn !== null ? (
        <Stat value={gustKn} unit="kn" label="gust" numClass={numClass} />
      ) : (
        <div />
      )}
      {dirDeg != null ? (
        <div className="flex items-center gap-2">
          <DirectionNeedle directionDeg={dirDeg} size={needleSize} />
          <div className="leading-tight">
            <div
              className={`font-mono font-bold tracking-tight ${
                size === "detail" ? "text-3xl" : "text-xl"
              }`}
            >
              {dirLabel}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {Math.round(dirDeg)}°
            </div>
          </div>
        </div>
      ) : (
        <div />
      )}
      <Stat value={dur} unit="min" label="duration" align="right" numClass={numClass} />
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  accent = false,
  align = "left",
  numClass,
}: {
  value: number;
  unit: string;
  label: string;
  accent?: boolean;
  align?: "left" | "right";
  numClass: string;
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="leading-none">
        <span
          className={[
            "font-mono font-bold tracking-tight",
            numClass,
            accent ? "text-emerald-600 dark:text-emerald-400" : "",
          ].join(" ")}
        >
          {value}
        </span>
        <span className="ml-1 text-sm text-zinc-500">{unit}</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function DirectionNeedle({
  directionDeg,
  size,
}: {
  directionDeg: number;
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const tip = needleEndpoint(cx, cy, r - 3, directionDeg);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Wind direction ${Math.round(directionDeg)}°`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="fill-zinc-50 stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800"
        strokeWidth="1"
      />
      {[0, 90, 180, 270].map((deg) => {
        const inner = cy - r + 2;
        const tickEnd = cy - r + 5;
        return (
          <line
            key={deg}
            x1={cx}
            y1={inner}
            x2={cx}
            y2={tickEnd}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth="1"
            transform={`rotate(${deg} ${cx} ${cy})`}
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        className="stroke-emerald-600 dark:stroke-emerald-400"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx={tip.x}
        cy={tip.y}
        r="2"
        className="fill-emerald-600 dark:fill-emerald-400"
      />
      <circle cx={cx} cy={cy} r="1.5" className="fill-zinc-400 dark:fill-zinc-600" />
    </svg>
  );
}
