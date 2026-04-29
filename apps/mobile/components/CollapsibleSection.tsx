import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Section wrapper with a Pressable header bar that collapses its children.
// Mobile twin of the web CollapsibleSection — same shape, RN-flavoured.
export function CollapsibleSection({
  title,
  subtitle,
  rightAccessory,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  rightAccessory?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Header is a row: left side is a Pressable (toggles open/closed),
  // right side hosts an optional rightAccessory which may itself be
  // interactive — so it sits OUTSIDE the toggle Pressable.
  return (
    <View>
      <View style={styles.header}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {typeof subtitle === "string" ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : subtitle ? (
              <View style={{ marginTop: 2 }}>{subtitle}</View>
            ) : null}
          </View>
          <Text style={[styles.chevron, open ? styles.chevronOpen : null]}>▾</Text>
        </Pressable>
        {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
      </View>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  pressed: { backgroundColor: "#fafafa" },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  subtitle: { marginTop: 4, fontSize: 11, color: "#a1a1aa" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  chevron: { fontSize: 16, color: "#a1a1aa" },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
});
