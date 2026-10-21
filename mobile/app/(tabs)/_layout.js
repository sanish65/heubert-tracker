import { Tabs } from "expo-router";
import TabBar from "../../components/TabBar";

// The canvas tab bar (components/TabBar.js) draws the five tabs. Each tab screen draws its own
// header, components/TopBar.js, so the navigator's is off.
const renderTabBar = (props) => <TabBar {...props} />;

export default function TabsLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      {/* A tab route without a tab: Attendance opens from Home. */}
      <Tabs.Screen name="attendance" options={{ title: "Attendance", href: null }} />
      <Tabs.Screen name="fines" options={{ title: "Fines" }} />
      <Tabs.Screen name="leaves" options={{ title: "Leaves" }} />
      <Tabs.Screen name="team" options={{ title: "Team" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
