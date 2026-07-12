import { Pressable, Text } from "react-native";
import { Link } from "expo-router";
import { Screen, Card } from "../../components/ui";
import { useThemeColors } from "../../lib/theme";
import { useApp } from "../../context/AppContext";

const ITEMS = [
  { icon: "📖", label: "Word of the Day", href: "/words" },
  { icon: "📅", label: "Events", href: "/events" },
  { icon: "🃏", label: "Planning Poker", href: "/planning-poker" },
  { icon: "🗂️", label: "Retrospective", href: "/retrospective" },
  { icon: "✨", label: "Team Memories", href: "/memories" },
  { icon: "🚀", label: "Meeting Mode", href: "/meeting" },
  { icon: "💸", label: "Withdrawals", href: "/withdrawals" },
  { icon: "⚙️", label: "Settings", href: "/settings" },
];

const ADMIN_ITEMS = [
  { icon: "🗂️", label: "Leave Settings", href: "/leave-settings" },
];

export default function MoreScreen() {
  const t = useThemeColors();
  const { user, isAdmin } = useApp();
  const items = isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS;

  return (
    <Screen>
      <Card>
        <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>
          Hi, {user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there"}
        </Text>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{user?.email}</Text>
      </Card>

      {items.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable>
            <Card style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
              <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "600", flex: 1 }}>{item.label}</Text>
              <Text style={{ color: t.textMuted, fontSize: 16 }}>›</Text>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
