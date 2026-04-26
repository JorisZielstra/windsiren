import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import type { MonthlySessionsBucket } from "@windsiren/core";

type Props = {
  buckets: MonthlySessionsBucket[];
};

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function MonthlySessionsChart({ buckets }: Props) {
  const [active, setActive] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <Text style={styles.empty}>No session history yet.</Text>
    );
  }

  const max = Math.max(1, ...buckets.map((b) => b.sessionCount));
  const w = 320;
  const h = 160;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const slot = innerW / buckets.length;
  const barW = Math.max(8, slot * 0.6);

  const activeBucket = active !== null ? buckets[active] : null;

  return (
    <View>
      <Pressable onPress={() => setActive(null)}>
        <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
          <Line
            x1={padL}
            y1={padT + innerH}
            x2={w - padR}
            y2={padT + innerH}
            stroke="#e4e4e7"
            strokeWidth={1}
          />
          {buckets.map((b, i) => {
            const cx = padL + slot * (i + 0.5);
            const barH = b.sessionCount > 0 ? Math.max(4, (b.sessionCount / max) * innerH) : 2;
            const y = padT + innerH - barH;
            const isActive = active === i;
            const isFirstOfYear = b.monthKey.endsWith("-01");
            const monthIdx = parseInt(b.monthKey.slice(5, 7), 10) - 1;
            const letter = MONTH_LETTERS[monthIdx] ?? "";
            const fill =
              b.sessionCount > 0
                ? isActive
                  ? "#059669"
                  : "#10b981"
                : "#e4e4e7";
            return (
              <React.Fragment key={b.monthKey}>
                <Rect
                  x={cx - barW / 2}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={fill}
                  onPressIn={() => setActive(i)}
                />
                <SvgText
                  x={cx}
                  y={padT + innerH + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#71717a"
                  fontWeight={isActive ? "700" : "400"}
                >
                  {letter}
                </SvgText>
                {isFirstOfYear ? (
                  <SvgText
                    x={cx}
                    y={padT + innerH + 24}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#a1a1aa"
                  >
                    {b.monthKey.slice(0, 4)}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      </Pressable>

      <View style={styles.captionRow}>
        {activeBucket ? (
          <Text style={styles.caption} numberOfLines={1}>
            <Text style={styles.captionStrong}>
              {formatMonth(activeBucket.monthKey)}
            </Text>
            {" · "}
            <Text style={styles.captionMono}>{activeBucket.sessionCount}</Text>{" "}
            session{activeBucket.sessionCount === 1 ? "" : "s"}
            {activeBucket.totalMinutes > 0
              ? ` · ${formatDuration(activeBucket.totalMinutes)}`
              : ""}
          </Text>
        ) : (
          <Text style={styles.caption}>Tap a bar to see the month.</Text>
        )}
      </View>
    </View>
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

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: "#71717a" },
  captionRow: { marginTop: 4, minHeight: 18 },
  caption: { fontSize: 11, color: "#71717a" },
  captionStrong: { color: "#18181b", fontWeight: "600" },
  captionMono: { color: "#18181b", fontVariant: ["tabular-nums"] },
});
