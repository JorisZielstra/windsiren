import { Image, StyleSheet, Text, View } from "react-native";

type Props = {
  url: string | null;
  name: string | null;
  size?: number;
};

export function Avatar({ url, name, size = 84 }: Props) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const bg = bgColorFor(name ?? "");
  const radius = size / 2;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius, backgroundColor: bg },
      ]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

function bgColorFor(seed: string): string {
  if (!seed) return "#71717a";
  const palette = [
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#ec4899",
    "#06b6d4",
    "#14b8a6",
    "#84cc16",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
}

const styles = StyleSheet.create({
  circle: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#fff", fontWeight: "600" },
});
