import { Tabs } from "expo-router";
import { View } from "react-native";
import { WeatherStrip } from "../../components/WeatherStrip";

// Custom header component: just the weather strip.
function StripHeader() {
  return (
    <View style={{ paddingTop: 50 }}>
      <WeatherStrip />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <StripHeader />,
        tabBarActiveTintColor: "#059669", // emerald-600
        tabBarInactiveTintColor: "#71717a",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#e5e5e5",
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: () => null }} />
      <Tabs.Screen name="spots" options={{ title: "Spots", tabBarIcon: () => null }} />
      <Tabs.Screen name="map" options={{ title: "Map", tabBarIcon: () => null }} />
      <Tabs.Screen name="feed" options={{ title: "Feed", tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: () => null }} />
    </Tabs>
  );
}
