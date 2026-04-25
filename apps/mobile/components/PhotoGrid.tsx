import { Image, StyleSheet, View } from "react-native";

type Props = {
  urls: string[];
};

export function PhotoGrid({ urls }: Props) {
  if (urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <View style={styles.singleWrap}>
        <Image source={{ uri: urls[0] }} style={styles.single} />
      </View>
    );
  }
  return (
    <View style={[styles.grid, urls.length === 3 ? styles.gridThree : null]}>
      {urls.map((u, i) => (
        <Image key={u} source={{ uri: u }} style={[styles.tile, tileExtra(urls.length, i)]} />
      ))}
    </View>
  );
}

function tileExtra(n: number, i: number) {
  if (n === 3 && i === 0) return styles.tileThreeFirst;
  return null;
}

const styles = StyleSheet.create({
  singleWrap: { marginTop: 10, borderRadius: 8, overflow: "hidden", backgroundColor: "#f4f4f5" },
  single: { width: "100%", aspectRatio: 16 / 9 },
  grid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  gridThree: { flexDirection: "row" },
  tile: {
    flex: 1,
    minWidth: "48%",
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: "#f4f4f5",
  },
  tileThreeFirst: { minWidth: "100%" },
});
