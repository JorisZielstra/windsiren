import { cardinalLabelPositions, needleEndpoint, safeSectorPaths } from "@windsiren/core";
import type { DirectionRange } from "@windsiren/shared";

type Props = {
  safeDirections: DirectionRange[];
  currentWindDirectionDeg?: number | null;
  size?: number;
};

// Visual compass showing a spot's safe wind directions (filled sectors) and
// the current wind direction (needle). Safe sectors indicate which directions
// the spot works with; needle shows where the wind is coming FROM.
export function WindRose({ safeDirections, currentWindDirectionDeg, size = 120 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 12; // leave room for N/E/S/W labels
  const labelR = size / 2 - 4;
  const labels = cardinalLabelPositions(cx, cy, labelR);
  const safePaths = safeSectorPaths(cx, cy, outer, safeDirections);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label="Wind rose showing safe wind directions and current wind"
    >
      {/* Background */}
      <circle cx={cx} cy={cy} r={outer} className="fill-zinc-50 stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800" strokeWidth="1" />

      {/* Safe direction sectors */}
      {safePaths.map((d, i) => (
        <path
          key={i}
          d={d}
          className="fill-emerald-200/60 stroke-emerald-500/40 dark:fill-emerald-900/40 dark:stroke-emerald-700/50"
          strokeWidth="1"
        />
      ))}

      {/* Cardinal tick lines */}
      {[0, 90, 180, 270].map((deg) => {
        const inner = cy - outer + 2;
        const tick = cy - outer - 2;
        const transform = `rotate(${deg} ${cx} ${cy})`;
        return (
          <line
            key={deg}
            x1={cx}
            y1={inner}
            x2={cx}
            y2={tick + 4}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth="1"
            transform={transform}
          />
        );
      })}

      {/* Current wind needle */}
      {typeof currentWindDirectionDeg === "number" ? (
        <WindNeedle cx={cx} cy={cy} radius={outer} directionDeg={currentWindDirectionDeg} />
      ) : null}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="2" className="fill-zinc-400 dark:fill-zinc-600" />

      {/* N / E / S / W labels */}
      <text x={labels.N.x} y={labels.N.y + 3} textAnchor="middle" className="fill-zinc-500 text-[9px] font-semibold dark:fill-zinc-400">N</text>
      <text x={labels.E.x} y={labels.E.y + 3} textAnchor="middle" className="fill-zinc-500 text-[9px] font-semibold dark:fill-zinc-400">E</text>
      <text x={labels.S.x} y={labels.S.y + 3} textAnchor="middle" className="fill-zinc-500 text-[9px] font-semibold dark:fill-zinc-400">S</text>
      <text x={labels.W.x} y={labels.W.y + 3} textAnchor="middle" className="fill-zinc-500 text-[9px] font-semibold dark:fill-zinc-400">W</text>
    </svg>
  );
}

function WindNeedle({
  cx,
  cy,
  radius,
  directionDeg,
}: {
  cx: number;
  cy: number;
  radius: number;
  directionDeg: number;
}) {
  const tip = needleEndpoint(cx, cy, radius - 3, directionDeg);
  return (
    <g>
      <line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        className="stroke-sky-600 dark:stroke-sky-400"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={tip.x} cy={tip.y} r="3" className="fill-sky-600 dark:fill-sky-400" />
    </g>
  );
}
