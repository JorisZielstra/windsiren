import { StyleSheet, Text, View } from "react-native";
import type { Verdict } from "@windsiren/shared";

type Props = {
  verdict: Verdict | null;
};

// Pill-shaped GO / MAYBE / NO GO badge for any spot row in the app
// (home page collapsible, /spots tab, search results).
export function VerdictPill({ verdict }: Props) {
  if (!verdict) {
    return (
      <View style={[styles.pill, { backgroundColor: "#f4f4f5" }]}>
        <Text style={[styles.text, { color: "#71717a" }]}>No data</Text>
      </View>
    );
  }
  const palette = {
    go: { bg: "#dcfce7", fg: "#065f46" },
    marginal: { bg: "#fef3c7", fg: "#92400e" },
    no_go: { bg: "#f4f4f5", fg: "#52525b" },
  } as const;
  const labels = { go: "GO", marginal: "MAYBE", no_go: "NO GO" } as const;
  const p = palette[verdict.decision];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.text, { color: p.fg }]}>{labels[verdict.decision]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
