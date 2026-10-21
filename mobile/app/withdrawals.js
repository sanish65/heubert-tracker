import { useState } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { formatStamp } from "../lib/dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Eyebrow, EmptyState, Button, IconButton, TextField, FormModal } from "../components/ui";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { SheetNote, SheetActions } from "../components/SheetParts";

// Withdrawals, as the canvas's MobileWithdrawals.dc.html: Back to Fines, the fine jar (every paid
// fine, what has been withdrawn, what is left), then the history. Fine admins (canManageFines) get
// Withdraw at the bottom and delete on each row. Recording and deleting call AppContext as before.

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function WithdrawModal({ isOpen, onClose }) {
  const { addWithdrawal, user } = useApp();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return setError("Please enter a valid amount greater than 0.");
    if (!reason.trim()) return setError("Please provide a reason for withdrawal.");

    setSubmitting(true);
    try {
      await addWithdrawal(parsedAmount, reason.trim());
      setAmount("");
      setReason("");
      onClose();
    } catch (err) {
      setError("Failed to record withdrawal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Record Withdrawal">
      <TextField
        label="Amount (Rs.)"
        value={amount}
        onChangeText={(v) => { setAmount(v); setError(""); }}
        placeholder="e.g. 500"
        keyboardType="numeric"
        style={styles.amountInput}
      />
      <TextField label="Reason" value={reason} onChangeText={(v) => { setReason(v); setError(""); }} placeholder="e.g. Office supplies, team lunch..." multiline />
      <TextField label="Withdrawn By" value={user?.user_metadata?.full_name || user?.email || ""} editable={false} />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={submitting ? "Saving..." : "Record Withdrawal"} onPress={handleSubmit} disabled={submitting} onCancel={onClose} />
    </FormModal>
  );
}

// One of the jar's three figures: a mono label (Out and Left carry their colour in the bar), the sum.
function JarFigure({ label, value, dot }) {
  const t = useThemeColors();
  return (
    <View style={[styles.figure, { backgroundColor: t.raised, borderColor: t.line }]}>
      <View style={styles.figureHead}>
        {dot ? <View style={[styles.figureDot, { backgroundColor: dot }]} /> : null}
        <Text numberOfLines={1} style={[styles.figureLabel, { color: t.text3 }]}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.figureValue, { color: t.text1 }]}>
        {value}
      </Text>
    </View>
  );
}

// One withdrawal, as the canvas's history row: the sum and the day, the reason, who took it out.
function WithdrawalRow({ withdrawal, isMe, canDelete, onDelete }) {
  const t = useThemeColors();
  const date = formatStamp(withdrawal.created_at);
  return (
    <View style={[styles.entry, { borderTopColor: t.line }]}>
      <View style={styles.entryMain}>
        <View style={styles.entryTop}>
          <Text style={[styles.entryAmount, { color: t.text1 }]}>{rs(withdrawal.amount)}</Text>
          {date ? <Text style={[styles.entryDate, { color: t.text3 }]}>{date}</Text> : null}
        </View>
        {withdrawal.reason ? <Text style={[styles.entryReason, { color: t.text2 }]}>{withdrawal.reason}</Text> : null}
        {withdrawal.withdrawn_by ? (
          <View style={styles.entryBy}>
            <Avatar name={withdrawal.withdrawn_by} size={22} isMe={isMe} />
            <Text numberOfLines={1} style={[styles.entryByText, { color: t.text3 }]}>
              Withdrawn by {withdrawal.withdrawn_by}
            </Text>
          </View>
        ) : null}
      </View>
      {canDelete ? (
        <IconButton
          icon="trash"
          tone="plain"
          size={44}
          onPress={() => onDelete(withdrawal)}
          accessibilityLabel={`Delete withdrawal of ${rs(withdrawal.amount)}${date ? ` on ${date}` : ""}`}
          style={styles.entryDelete}
        />
      ) : null}
    </View>
  );
}

// Withdraw, pinned to the bottom as the canvas draws it, the list fading into the ink under it
// (the canvas's linear-gradient to the top: ink up to 55%, then clear).
function WithdrawBar({ onPress }) {
  const t = useThemeColors();
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  // The theme is in the id, as the aurora's, so a theme flip defines a new gradient.
  const fadeId = `withdraw-fade-${theme}`;
  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.ink} stopOpacity={0} />
            <Stop offset="0.45" stopColor={t.ink} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
      </Svg>
      <Button title="Withdraw" icon="arrow-down-to-line" onPress={onPress} style={[styles.withdraw, { boxShadow: t.glowPrimaryLg }]} />
    </View>
  );
}

export default function WithdrawalsScreen() {
  const { withdrawals, canManageFines, deleteWithdrawal, fines, user } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack("/fines");
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);

  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  // The jar holds every paid fine, as Home and the Fines summary count it; it never shows below 0.
  const collected = fines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
  const remaining = Math.max(collected - totalWithdrawn, 0);
  // The bar is the collected sum: what went out, then what is left; empty until a fine is paid.
  const outShare = collected > 0 ? Math.min(totalWithdrawn / collected, 1) : 0;
  const leftShare = collected > 0 ? remaining / collected : 0;
  // The name a withdrawal records (AppContext's addWithdrawal), so yours get your orange avatar.
  const myName = user?.user_metadata?.full_name || user?.email || "";

  const confirmDelete = (w) => {
    Alert.alert("Delete withdrawal?", `Rs. ${w.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWithdrawal(w.id) },
    ]);
  };

  return (
    <View style={styles.page}>
      {/* Fine admins: room under the history for Withdraw (16 + 52 + its bottom inset). */}
      <Screen style={canManageFines ? { paddingBottom: 84 + Math.max(insets.bottom, 16) } : undefined}>
        <ScreenHeader title="Withdrawals" onBack={goBack} centered />

        <Card style={styles.jar}>
          <View style={styles.jarHead}>
            <View style={[styles.jarIcon, { backgroundColor: t.pbViolet }]}>
              <Icon name="banknote" size={20} color={t.pfViolet} />
            </View>
            <View style={styles.jarTitles}>
              <View accessible accessibilityRole="header">
                <Eyebrow style={styles.jarTitle}>Fine jar</Eyebrow>
              </View>
              <Text style={[styles.jarNote, { color: t.text3 }]}>Paid fines minus withdrawals</Text>
            </View>
          </View>

          <View style={styles.jarSum}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.jarValue, { color: t.text1 }]}>
              {rs(remaining)}
            </Text>
            <Text style={[styles.jarValueNote, { color: t.text2 }]}>left in the jar</Text>
          </View>

          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${rs(totalWithdrawn)} of ${rs(collected)} collected has been withdrawn`}
            style={[styles.track, { backgroundColor: t.raised, borderColor: t.line }]}
          >
            {outShare > 0 ? <View style={{ width: `${outShare * 100}%`, backgroundColor: t.primary }} /> : null}
            {leftShare > 0 ? <View style={[styles.trackLeft, { width: `${leftShare * 100}%`, backgroundColor: t.cyan }]} /> : null}
          </View>

          <View style={styles.figures}>
            <JarFigure label="Collected" value={rs(collected)} />
            <JarFigure label="Out" value={rs(totalWithdrawn)} dot={t.primary} />
            <JarFigure label="Left" value={rs(remaining)} dot={t.cyan} />
          </View>
        </Card>

        <Card style={styles.history}>
          <View style={styles.historyHead}>
            <Text accessibilityRole="header" style={[styles.historyTitle, { color: t.text1 }]}>
              History
            </Text>
            <Text style={[styles.historyCount, { color: t.text3 }]}>
              {rs(totalWithdrawn)} withdrawn · {plural(withdrawals.length, "record")}
            </Text>
          </View>
          {withdrawals.length === 0 ? (
            <EmptyState icon="banknote" text="No withdrawals recorded yet." />
          ) : (
            withdrawals.map((w) => (
              <WithdrawalRow
                key={w.id}
                withdrawal={w}
                isMe={!!myName && w.withdrawn_by === myName}
                canDelete={canManageFines}
                onDelete={confirmDelete}
              />
            ))
          )}
        </Card>
      </Screen>

      {canManageFines ? <WithdrawBar onPress={() => setShowModal(true)} /> : null}

      <WithdrawModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

// Sizes, gaps and type from MobileWithdrawals.dc.html; letter-spacing in em becomes pixels at the
// text's size (-0.02em at 38px is -0.76, .04em at 12px is 0.48).
const styles = StyleSheet.create({
  page: { flex: 1 },

  // The jar: a 20-radius glass card, 18 in, 14 between its parts.
  jar: { borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 18, gap: 14 },
  jarHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  jarIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  jarTitles: { flex: 1, gap: 2 },
  jarTitle: { fontFamily: fonts.monoMedium },
  jarNote: { fontFamily: fonts.body, fontSize: 13 },
  jarSum: { gap: 2 },
  // The canvas's line is 1.05; a little more here, so Android does not clip the figures' tops.
  jarValue: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -0.76, fontVariant: ["tabular-nums"] },
  jarValueNote: { fontFamily: fonts.body, fontSize: 14 },
  track: { flexDirection: "row", height: 12, borderRadius: radius.pill, borderWidth: 1, overflow: "hidden" },
  trackLeft: { opacity: 0.55 },
  figures: { flexDirection: "row", gap: 8 },
  figure: { flex: 1, gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1 },
  figureHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  figureDot: { width: 7, height: 7, borderRadius: 2 },
  figureLabel: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.48, textTransform: "uppercase" },
  figureValue: { fontFamily: fonts.monoMedium, fontSize: 15 },

  // History: a 20-radius glass card, 6 at the bottom under the last row; each row on a hairline.
  history: { borderRadius: radius.xl, paddingTop: 16, paddingBottom: 6 },
  historyHead: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingBottom: 10 },
  historyTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  historyCount: { fontFamily: fonts.mono, fontSize: 12 },
  entry: { flexDirection: "row", gap: 12, paddingVertical: 14, borderTopWidth: 1 },
  entryMain: { flex: 1, minWidth: 0, gap: 6 },
  entryTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  entryAmount: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 17 },
  entryDate: { fontFamily: fonts.mono, fontSize: 12 },
  entryReason: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  entryBy: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryByText: { flex: 1, fontFamily: fonts.body, fontSize: 13 },
  entryDelete: { marginRight: -8, borderRadius: radius.md },

  // Amounts are typed in the mono font, as they are shown.
  amountInput: { fontFamily: fonts.mono },

  // Withdraw: across the screen, 16 in, over the ink the list fades into.
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 16 },
  withdraw: { minHeight: 52, borderRadius: 14 },
});
