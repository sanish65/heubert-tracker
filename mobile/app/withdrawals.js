import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField, FormModal } from "../components/ui";

function WithdrawModal({ isOpen, onClose }) {
  const { addWithdrawal, user } = useApp();
  const t = useThemeColors();
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
    <FormModal visible={isOpen} onClose={onClose} title="💸 Record Withdrawal">
      <TextField label="Amount (Rs.)" value={amount} onChangeText={(v) => { setAmount(v); setError(""); }} placeholder="e.g. 500" keyboardType="numeric" />
      <TextField label="Reason" value={reason} onChangeText={(v) => { setReason(v); setError(""); }} placeholder="e.g. Office supplies, team lunch..." multiline />
      <TextField label="Withdrawn By" value={user?.user_metadata?.full_name || user?.email || ""} editable={false} />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={submitting ? "Saving..." : "Record Withdrawal"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}

export default function WithdrawalsScreen() {
  const { withdrawals, isAdmin, deleteWithdrawal } = useApp();
  const t = useThemeColors();
  const [showModal, setShowModal] = useState(false);

  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  const formatDate = (ts) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const confirmDelete = (w) => {
    Alert.alert("Delete withdrawal?", `Rs. ${w.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWithdrawal(w.id) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Withdrawals" }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <SectionTitle>💸 Withdrawals</SectionTitle>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>
              Rs. {totalWithdrawn.toLocaleString()} withdrawn · {withdrawals.length} record{withdrawals.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {isAdmin && <Button title="+ Withdraw" small onPress={() => setShowModal(true)} />}
        </View>

        {withdrawals.length === 0 ? (
          <EmptyState text="No withdrawals recorded yet." />
        ) : (
          withdrawals.map((w) => (
            <View key={w.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: t.textPrimary, fontWeight: "700", fontSize: 15 }}>Rs. {w.amount.toLocaleString()}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: t.textMuted, fontSize: 12 }}>{formatDate(w.created_at)}</Text>
                  {isAdmin && (
                    <Text onPress={() => confirmDelete(w)} style={{ fontSize: 14 }}>
                      🗑
                    </Text>
                  )}
                </View>
              </View>
              <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 4 }}>{w.reason}</Text>
              <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>— {w.withdrawn_by}</Text>
            </View>
          ))
        )}
      </Card>

      <WithdrawModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </Screen>
  );
}
