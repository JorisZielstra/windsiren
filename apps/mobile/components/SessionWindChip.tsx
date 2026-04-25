import { StyleSheet, Text, View } from "react-native";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";

type Props = {
  session: Pick<SessionRow, "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms">;
};

export function SessionWindChip({ session }: Props) {
  if (session.wind_avg_ms == null) return null;
  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const dir =
    session.wind_dir_avg_deg != null ? cardinalDirection(session.wind_dir_avg_deg) : null;
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;

  return (
    <View style={styles.chip}>
      <Text style={[styles.text, styles.mono]}>{avgKn} kn</Text>
      {dir ? <Text style={styles.muted}>{dir}</Text> : null}
      {gustKn !== null ? (
        <>
          <Text style={styles.dim}>·</Text>
          <Text style={styles.muted}>gust</Text>
          <Text style={[styles.text, styles.mono]}>{gustKn}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f4f4f5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, color: "#3f3f46", fontWeight: "500" },
  mono: { fontVariant: ["tabular-nums"] },
  muted: { fontSize: 11, color: "#71717a" },
  dim: { fontSize: 11, color: "#a1a1aa" },
});
