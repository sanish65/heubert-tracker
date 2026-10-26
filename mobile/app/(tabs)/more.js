import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import Constants from "expo-constants";
import { useApp } from "../../context/AppContext";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, Card, Eyebrow, IconButton, Pill } from "../../components/ui";
import TopBar from "../../components/TopBar";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";

// More, as the canvas's MobileMore.dc.html: your profile with a way into Settings, then every other
// screen in the canvas's groups, each row an icon tile, its name and a chevron, and the app's version
// at the foot. Daily Standup, Tasks and Team Calendar joined the Team group with the web's tabs of
// the same names (docs/mobile-web-parity.md); Leave Settings, under Admin, is still for admins only.

// The canvas's groups and rows. `sub` is the line under a name: the canvas's words where they say
// what the screen has. Word of the Day's line on the canvas is sample data ("Today: …"), so it has
// none; Events, Retrospective and Settings keep only what those screens offer.
const GROUPS = [
  {
    title: "Team",
    rows: [
      { label: "Daily Standup", sub: "Your update and shout-outs", href: "/standup", icon: "message", tone: "cyan" },
      { label: "Tasks", sub: "Board, backlog and issues", href: "/tasks", icon: "kanban", tone: "blue" },
      { label: "Team Calendar", sub: "Everyone's meetings, leaves and holidays", href: "/calendar", icon: "clock", tone: "violet" },
      { label: "Word of the Day", href: "/words", icon: "book", tone: "blue" },
      { label: "Events", sub: "Company events", href: "/events", icon: "calendar-days", tone: "cyan" },
      { label: "Planning Poker", sub: "Estimate stories together", href: "/planning-poker", icon: "cards", tone: "violet" },
      { label: "Retrospective", sub: "Sprint boards", href: "/retrospective", icon: "columns", tone: "green" },
      { label: "Meeting Mode", sub: "Daily standup at a glance", href: "/meeting", icon: "presentation", tone: "orange" },
    ],
  },
  {
    title: "Records",
    rows: [
      { label: "Withdrawals", sub: "Spending from the fine fund", href: "/withdrawals", icon: "cash", tone: "amber" },
      { label: "Projects", sub: "Active and archived projects", href: "/projects", icon: "folder", tone: "blue" },
      { label: "Team Memories", sub: "Photos from team moments", href: "/memories", icon: "image", tone: "violet" },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    rows: [{ label: "Leave Settings", sub: "Leave types and yearly quotas", href: "/leave-settings", icon: "sliders-vertical", tone: "gray" }],
  },
  {
    title: "App",
    rows: [
      { label: "What's new", sub: "Every feature, and the latest updates", href: "/whats-new", icon: "gift", tone: "violet" },
      { label: "Settings", sub: "Theme, animations, account", href: "/settings", icon: "gear", tone: "gray" },
    ],
  },
];

// The icon tiles take a pill's tint and text colour. Meeting Mode's is the orange of people
// moments, with dark ink and its glow, as the canvas.
const TILE_TONES = {
  blue: ["pbBlue", "pfBlue"],
  cyan: ["pbCyan", "pfCyan"],
  violet: ["pbViolet", "pfViolet"],
  green: ["pbGreen", "pfGreen"],
  amber: ["pbAmber", "pfAmber"],
  gray: ["pbGray", "pfGray"],
};

// The version in the app's config (app.config.js), as the build or update running on the phone has it.
const APP_VERSION = Constants.expoConfig?.version;

// One destination. Link hands its press to the Pressable, which must take no style of its own (Link
// merges styles into a plain object), so the row's look is on the View inside.
function LinkRow({ row, first, last }) {
  const t = useThemeColors();
  const orange = row.tone === "orange";
  const [fill, ink] = TILE_TONES[row.tone] || TILE_TONES.gray;
  return (
    <Link href={row.href} asChild>
      <Pressable>
        {({ pressed }) => (
          <View
            style={[
              styles.row,
              { borderTopColor: first ? "transparent" : t.line },
              first && styles.rowFirst,
              last && styles.rowLast,
              pressed && { backgroundColor: t.pbGray },
            ]}
          >
            <View style={[styles.tile, orange ? { backgroundColor: t.orange, boxShadow: t.glowOrangeSm } : { backgroundColor: t[fill] }]}>
              <Icon name={row.icon} size={19} strokeWidth={1.9} color={orange ? "#0A0E17" : t[ink]} />
            </View>
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={[styles.rowLabel, { color: t.text1 }]}>
                {row.label}
              </Text>
              {row.sub ? (
                <Text numberOfLines={1} style={[styles.rowSub, { color: t.text3 }]}>
                  {row.sub}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-right" size={18} strokeWidth={2} color={t.text3} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

// A group: its mono caps title on the page (text2, which stays 4.5:1 over the aurora where the
// canvas's text3 does not), Admin's "Admins only" pill, then its rows in one glass panel.
function LinkGroup({ group }) {
  const t = useThemeColors();
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <View accessible accessibilityRole="header">
          <Eyebrow style={[styles.groupTitle, { color: t.text2 }]}>{group.title}</Eyebrow>
        </View>
        {group.adminOnly ? (
          <Pill tone="violet" style={styles.adminsOnly}>
            Admins only
          </Pill>
        ) : null}
      </View>
      <Card style={styles.list}>
        {group.rows.map((row, i) => (
          <LinkRow key={row.href} row={row} first={i === 0} last={i === group.rows.length - 1} />
        ))}
      </Card>
    </View>
  );
}

export default function MoreScreen() {
  const t = useThemeColors();
  const { user, isAdmin, currentEmployee } = useApp();
  const groups = GROUPS.filter((group) => !group.adminOnly || isAdmin);
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  // The name your avatar is drawn from, as the top bar's account button.
  const myName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "";

  return (
    <Screen>
      <TopBar title="More" eyebrow="Everything else" bell={false} account={false} />

      <View style={styles.page}>
        <Card style={styles.profile}>
          <View style={[styles.profileAvatar, { boxShadow: t.glowOrange }]}>
            <Avatar name={myName} size={56} isMe />
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[styles.greeting, { color: t.text1 }]}>
              Hi, {firstName}
            </Text>
            {user?.email ? (
              <Text numberOfLines={1} style={[styles.email, { color: t.text3 }]}>
                {user.email}
              </Text>
            ) : null}
            {isAdmin ? (
              <Pill tone="violet" style={styles.adminPill}>
                Admin
              </Pill>
            ) : null}
          </View>
          <Link href="/settings" asChild>
            <IconButton
              icon="gear"
              tone="raised"
              size={44}
              iconSize={20}
              accessibilityLabel="Settings"
              style={{ borderRadius: 14, borderTopColor: t.glassHi }}
            />
          </Link>
        </Card>

        {groups.map((group) => (
          <LinkGroup key={group.title} group={group} />
        ))}

        {APP_VERSION ? <Text style={[styles.version, { color: t.text2 }]}>Heubert Tracker v{APP_VERSION}</Text> : null}
      </View>
    </Screen>
  );
}

// Sizes, gaps and type from MobileMore.dc.html: 22 between the profile and the groups, 8 between a
// group's title and its panel.
const styles = StyleSheet.create({
  page: { gap: 22 },

  // Your profile: a 20-radius glass card, 18 in, 14 between the avatar, the names and Settings.
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 0, paddingVertical: 18, borderRadius: radius.xl },
  profileAvatar: { borderRadius: radius.pill },
  profileText: { flex: 1, minWidth: 0, gap: 3 },
  greeting: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  email: { fontFamily: fonts.mono, fontSize: 12 },
  adminPill: { alignSelf: "flex-start", marginTop: 4 },

  group: { gap: 8 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  groupTitle: { fontFamily: fonts.monoMedium },
  adminsOnly: { height: 20, paddingHorizontal: 7 },

  // The panel: the rows run edge to edge, so the card's padding goes.
  list: { marginBottom: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: radius.xl },
  // A row: 64 high, 16 in, a hairline above all but the first. Inside the panel's 1px edge, the
  // pressed fill rounds at 19 on the outer corners.
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingHorizontal: 16, borderTopWidth: 1 },
  rowFirst: { borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  rowLast: { borderBottomLeftRadius: 19, borderBottomRightRadius: 19 },
  tile: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0, gap: 1, paddingVertical: 10 },
  rowLabel: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowSub: { fontFamily: fonts.body, fontSize: 13 },

  // On the page, so text2 rather than the canvas's text3.
  version: { fontFamily: fonts.mono, fontSize: 12, textAlign: "center", paddingTop: 4, paddingBottom: 8 },
});
