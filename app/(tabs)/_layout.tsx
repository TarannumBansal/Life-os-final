import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/src/theme";
import { Platform, View } from "react-native";

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 0.5,
          height: 82,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: "Today",
        tabBarButtonTestID: "tab-today",
        tabBarIcon: ({ color }) => <Feather name="sun" size={20} color={color} />,
      }} />
      <Tabs.Screen name="roadmap" options={{
        title: "Roadmap",
        tabBarButtonTestID: "tab-roadmap",
        tabBarIcon: ({ color }) => <Feather name="map" size={20} color={color} />,
      }} />
      <Tabs.Screen name="domains" options={{
        title: "Domains",
        tabBarButtonTestID: "tab-domains",
        tabBarIcon: ({ color }) => <Feather name="grid" size={20} color={color} />,
      }} />
      <Tabs.Screen name="calendar" options={{
        title: "Calendar",
        tabBarButtonTestID: "tab-calendar",
        tabBarIcon: ({ color }) => <Feather name="calendar" size={20} color={color} />,
      }} />
      <Tabs.Screen name="analytics" options={{
        title: "Growth",
        tabBarButtonTestID: "tab-analytics",
        tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={20} color={color} />,
      }} />
      <Tabs.Screen name="health" options={{
        title: "Health",
        tabBarButtonTestID: "tab-health",
        tabBarIcon: ({ color }) => <Feather name="heart" size={20} color={color} />,
      }} />
      <Tabs.Screen name="journal" options={{
        title: "Journal",
        tabBarButtonTestID: "tab-journal",
        tabBarIcon: ({ color }) => <Feather name="book-open" size={20} color={color} />,
      }} />
    </Tabs>
  );
}
