import { useMemo, useState, useSyncExternalStore } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "../context/AppContext";
import { useThemeColors, fonts, radius } from "../lib/theme";
import { NOTIFY_DAYS, myFineNotifications, unseenCount, taskNotificationItem, mergeNotifications } from "../lib/notifications";
import { useTaskNotifications, markTaskNotificationsRead } from "../lib/useTaskNotifications";
import { formatBs } from "../lib/nepaliDate";
import { localToday } from "../lib/dates";
import { Eyebrow, IconButton, FormModal, EmptyState, Pill } from "./ui";
import Icon from "./Icon";
import Avatar from "./Avatar";

const SEEN_KEY = "heubert-notifications-seen";

// When the bell was last opened, shared by every top bar: each tab draws its own and stays mounted,
// so a copy per bar would leave the other tabs' dots lit. Read from storage once. Every read and
// write is guarded: without storage the bell still works and forgets on restart.
let seenAt = null;
let seenRequested = false;
const seenListeners = new Set();

function setSeenAt(value) {
  seenAt = value;
  seenListeners.forEach((listener) => listener());
}

function subscribeSeen(listener) {
  seenListeners.add(listener);
  if (!seenRequested) {
    seenRequested = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((stored) => {
        // A bell opened while this was read is newer than what was stored.
        if (seenAt === null && stored && Number.isFinite(Date.parse(stored))) setSeenAt(stored);
      })
      .catch(() => {});
  }
  return () => {
    seenListeners.delete(listener);
  };
}

const readSeenAt = () => seenAt;

function markSeen(value) {
  setSeenAt(value);
  AsyncStorage.setItem(SEEN_KEY, value).catch(() => {});
}

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

// A fine's day as the web bell writes it ("3 Kartik 2083 · Oct 19"); "" when it has none.
function fineDate(dateStr) {
  const day = String(dateStr || "").slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  const monthDay = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return [formatBs(day), monthDay].filter(Boolean).join(" · ");
}

// One fine in the bell's sheet, as the web bell's rows. Every row opens the Fines tab.
function NotificationRow({ item, isNew, onPress }) {
  const t = useThemeColors();
  const late = item.kind === "late";
  const paid = item.status === "paid";
  const title = late ? `Late fine · ${rs(item.amount)}` : "Standup contribution";
  const status = late ? (paid ? "Paid" : "Unpaid") : paid ? "Complete" : "Pending";
  const date = fineDate(item.date);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, date, status, isNew ? "New" : ""].filter(Boolean).join(", ")}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.pbGray }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.pbGray }]}>
        <Icon name={late ? "wallet" : "clipboard"} size={16} color={t.text2} />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text1 }]}>
          {title}
        </Text>
        {date ? (
          <Text numberOfLines={1} style={[styles.rowDate, { color: t.text3 }]}>
            {date}
          </Text>
        ) : null}
      </View>
      {isNew ? <View style={[styles.newDot, { backgroundColor: t.cyan }]} /> : null}
      <Pill tone={paid ? "green" : "amber"}>{status}</Pill>
    </Pressable>
  );
}

// "POR-4" for an issue, as the web's issueKey (src/lib/taskBoard.js).
function issueKey(project, task) {
  if (!task) return "";
  if (!project?.issue_key || task.number == null) return `#${task.id}`;
  return `${project.issue_key}-${task.number}`;
}

const TASK_ICONS = { assigned: "user", mentioned: "message", commented: "message-square", status: "kanban" };

// An issue update in the bell, as the web bell's task rows: what happened, the issue's title or the
// comment under it. It opens the issue in Tasks.
function TaskNotificationRow({ item, isNew, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.text, item.sub, isNew ? "New" : ""].filter(Boolean).join(", ")}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.pbGray }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.pbBlue }]}>
        <Icon name={TASK_ICONS[item.taskKind] || "kanban"} size={16} color={t.pfBlue} />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: t.text1 }]}>
          {item.text}
        </Text>
        {item.sub ? (
          <Text numberOfLines={1} style={[styles.rowSub, { color: t.text3 }]}>
            {item.sub}
          </Text>
        ) : null}
      </View>
      {isNew ? <View style={[styles.newDot, { backgroundColor: t.cyan }]} /> : null}
    </Pressable>
  );
}

// The header of the tab screens, as the canvas's Home and Fines: the eyebrow and the title, then the
// bell (the fines recorded against you lately, as the web bell) and your avatar, the account button,
// which opens More. Put it first inside <Screen>; it clears the status bar itself. `right` holds a
// screen's own header action (the canvas's Team "Add", Leaves filter), drawn before the bell.
// `bell={false}` leaves the bell out, for a tab whose artboard draws its own action in its place
// (MobileLeaves.dc.html: the employee filter, then the account button). `account={false}` leaves
// the account button out the same way (MobileTeam.dc.html draws only the title and Add); More
// stays one tap away in the tab bar.
export default function TopBar({ title, eyebrow, right, bell = true, account = true }) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fines, standupFines, currentEmployee, user, projects } = useApp();
  const taskRows = useTaskNotifications(Boolean(bell && currentEmployee));
  const seen = useSyncExternalStore(subscribeSeen, readSeenAt);
  const [open, setOpen] = useState(false);
  // The seen time from before this opening, so the rows that were new still say so.
  const [openedSeenAt, setOpenedSeenAt] = useState(null);

  // Keyed on today's date as well as the data: the 30-day window moves on each day even when no
  // fine changes, and any render after midnight (opening the bell is one) picks the new day up.
  const today = localToday();
  // Fines worked out from AppContext, and the task notifications the database wrote, in one list
  // newest first, as the web bell. A notification whose project has no issue key can't be opened,
  // so it's left out, as on the web.
  const notifications = useMemo(() => {
    const projectById = new Map((projects || []).map((p) => [p.id, p]));
    return mergeNotifications(
      myFineNotifications({
        fines,
        standupFines,
        name: currentEmployee?.name,
        now: new Date(),
        lateExcluded: Boolean(currentEmployee?.late_fine_excluded),
        standupExcluded: Boolean(currentEmployee?.standup_fine_excluded),
      }),
      taskRows
        .filter((n) => n.task && projectById.get(n.task.project_id)?.issue_key)
        .map((n) => taskNotificationItem(n, issueKey(projectById.get(n.task.project_id), n.task)))
    );
    // `today` is not read inside: it is the key that renews `now` once a day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fines, standupFines, currentEmployee, taskRows, projects, today]);
  const unseen = unseenCount(notifications, seen);

  const openBell = () => {
    setOpenedSeenAt(seen);
    markSeen(new Date().toISOString());
    setOpen(true);
    // Seen once the bell is opened, as fines already are.
    markTaskNotificationsRead(notifications.filter((n) => n.kind === "task" && !n.read).map((n) => n.notificationId));
  };

  const openIssue = (key) => {
    setOpen(false);
    router.navigate({ pathname: "/tasks", params: { issue: key, at: String(Date.now()) } });
  };

  // The sheet closes first: the tab under it stays mounted, and so would the open sheet.
  const openFines = () => {
    setOpen(false);
    router.navigate("/fines");
  };

  const myName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "";

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.titles}>
          {eyebrow ? <Eyebrow onPage>{eyebrow}</Eyebrow> : null}
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: t.text1 }]}>
            {title}
          </Text>
        </View>
        {right}
        {bell ? (
          <View>
            <IconButton
              icon="bell"
              size={44}
              iconSize={20}
              onPress={openBell}
              accessibilityLabel={unseen > 0 ? `Notifications, ${unseen} new` : "Notifications"}
              style={styles.bell}
            />
            {unseen > 0 ? <View style={[styles.bellDot, { backgroundColor: t.cyan }]} /> : null}
          </View>
        ) : null}
        {account ? (
          <Pressable
            onPress={() => router.navigate("/more")}
            accessibilityRole="button"
            accessibilityLabel="Account"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar name={myName} size={44} isMe />
          </Pressable>
        ) : null}
      </View>

      <FormModal visible={bell && open} onClose={() => setOpen(false)} title="Notifications">
        {notifications.length === 0 ? (
          <EmptyState icon="bell" text={`Nothing new. Fines recorded against you and updates on your issues in the last ${NOTIFY_DAYS} days show here.`} />
        ) : (
          <View style={styles.list}>
            {notifications.map((item) =>
              item.kind === "task" ? (
                <TaskNotificationRow key={item.id} item={item} isNew={unseenCount([item], openedSeenAt) > 0} onPress={() => openIssue(item.issueKey)} />
              ) : (
                <NotificationRow key={item.id} item={item} isNew={unseenCount([item], openedSeenAt) > 0} onPress={openFines} />
              )
            )}
          </View>
        )}
      </FormModal>
    </>
  );
}

const styles = StyleSheet.create({
  // The canvas header sits 4px further in than the page's 16.
  bar: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 4, paddingBottom: 16 },
  titles: { flex: 1, gap: 4 },
  // The canvas's 28px with a 1.15 line and -0.02em.
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.56 },
  bell: { borderRadius: 14 },
  bellDot: { position: "absolute", top: 10, right: 11, width: 7, height: 7, borderRadius: radius.pill, pointerEvents: "none" },
  pressed: { opacity: 0.8 },
  list: { gap: 2 },
  // The web bell's rows (src/app/globals.css .topbar-row).
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  rowDate: { fontFamily: fonts.mono, fontSize: 12 },
  rowSub: { fontFamily: fonts.body, fontSize: 12 },
  newDot: { width: 6, height: 6, borderRadius: radius.pill },
});
