import { needleEndpoint } from "@windsiren/core";

type Props = {
  directionDeg: number;
  size: number;
};

// Compact "where the wind is coming from" needle. Same geometry as the
// full WindRose on the spot page so the visual language stays consistent
// across cards, detail pages, and the home dashboard.
export function DirectionNeedle({ directionDeg, size }: Props) {
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
