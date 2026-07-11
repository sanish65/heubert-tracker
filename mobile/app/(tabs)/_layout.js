import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useApp } from "../../context/AppContext";
import { themes } from "../../lib/theme";

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { theme } = useApp();
  const t = themes[theme];

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bgElevated },
        headerTintColor: t.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: { backgroundColor: t.bgElevated, borderTopColor: t.border },
        tabBarActiveTintColor: t.accentIndigo,
        tabBarInactiveTintColor: t.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="fines"
        options={{
          title: "Fines",
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: "Leaves",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏖️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon emoji="⋯" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
