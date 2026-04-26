import Svg, { Circle, Line } from "react-native-svg";
import { needleEndpoint } from "@windsiren/core";

type Props = {
  directionDeg: number;
  size: number;
};

export function DirectionNeedle({ directionDeg, size }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const tip = needleEndpoint(cx, cy, r - 3, directionDeg);
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="#fafafa" stroke="#e4e4e7" strokeWidth={1} />
      {[0, 90, 180, 270].map((deg) => {
        const inner = cy - r + 2;
        const tickEnd = cy - r + 5;
        return (
          <Line
            key={deg}
            x1={cx}
            y1={inner}
            x2={cx}
            y2={tickEnd}
            stroke="#d4d4d8"
            strokeWidth={1}
            origin={`${cx}, ${cy}`}
            rotation={deg}
          />
        );
      })}
      <Line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        stroke="#059669"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={tip.x} cy={tip.y} r={2} fill="#059669" />
      <Circle cx={cx} cy={cy} r={1.5} fill="#a1a1aa" />
    </Svg>
  );
}
