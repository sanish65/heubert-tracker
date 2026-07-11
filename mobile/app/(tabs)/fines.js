import { useState, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../../context/AppContext";
import { useThemeColors } from "../../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField, Chip } from "../../components/ui";
import AddFineModal from "../../components/AddFineModal";
import EditFineModal from "../../components/EditFineModal";
import AddStandupFineModal from "../../components/AddStandupFineModal";
import EditStandupModal from "../../components/EditStandupModal";

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function FineRow({ f, canManage, onEdit, onDelete, onToggle }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>{f.employee_name}</Text>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{formatDate(f.date)}{f.amount != null ? ` · Rs. ${f.amount}` : ""}</Text>
      </View>
      <Pressable onPress={() => canManage && onToggle(f)} disabled={!canManage}>
        <View style={{ backgroundColor: (f.status === "paid" ? t.accentGreen : t.accentRed) + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: canManage ? 10 : 0 }}>
          <Text style={{ color: f.status === "paid" ? t.accentGreen : t.accentRed, fontSize: 11, fontWeight: "700" }}>{f.status}</Text>
        </View>
      </Pressable>
      {canManage && (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={() => onEdit(f)}>
            <Text style={{ fontSize: 15 }}>✏️</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(f)}>
            <Text style={{ fontSize: 15 }}>🗑</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function FinesScreen() {
  const { fines, standupFines, toggleFineStatus, deleteFine, toggleStandupFineStatus, deleteStandupFine, isAdmin, isFineAdmin, withdrawals, isLoaded } = useApp();
  const t = useThemeColors();
  const canManage = isAdmin || isFineAdmin;

  const [tab, setTab] = useState("late");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddFine, setShowAddFine] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [editingStandup, setEditingStandup] = useState(null);

  const filteredFines = useMemo(() => {
    let list = [...fines];
    if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.employee_name.toLowerCase().includes(q) || f.date.includes(q) || String(f.amount).includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [fines, statusFilter, search]);

  const filteredStandups = useMemo(() => {
    let list = [...standupFines];
    if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.employee_name.toLowerCase().includes(q) || f.date.includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [standupFines, statusFilter, search]);

  const totalFiltered = filteredFines.reduce((s, f) => s + f.amount, 0);
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);

  const confirmDeleteFine = (f) => {
    Alert.alert("Delete fine?", `${f.employee_name} · Rs. ${f.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFine(f.id) },
    ]);
  };
  const confirmDeleteStandup = (f) => {
    Alert.alert("Delete record?", `${f.employee_name} · ${f.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteStandupFine(f.id) },
    ]);
  };
  const confirmToggleFine = (f) => {
    const next = f.status === "paid" ? "unpaid" : "paid";
    Alert.alert(`Mark as ${next}?`, `${f.employee_name} · Rs. ${f.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => toggleFineStatus(f.id) },
    ]);
  };
  const confirmToggleStandup = (f) => {
    const next = f.status === "paid" ? "unpaid" : "paid";
    Alert.alert(`Mark as ${next}?`, `${f.employee_name} · ${f.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => toggleStandupFineStatus(f.id) },
    ]);
  };

  return (
    <Screen>
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        <Chip label="💰 Late Fines" active={tab === "late"} onPress={() => setTab("late")} />
        <Chip label="📝 Standup Fines" active={tab === "standup"} onPress={() => setTab("standup")} />
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <View>
            <SectionTitle>{tab === "late" ? "Fine Records" : "Missing Standup Records"}</SectionTitle>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>
              {tab === "late" ? `${filteredFines.length} records · Rs. ${totalFiltered.toLocaleString()}` : `${filteredStandups.length} instances`}
            </Text>
          </View>
          <Button title="+ Record" small onPress={() => (tab === "late" ? setShowAddFine(true) : setShowAddStandup(true))} />
        </View>

        <TextField placeholder="Search by name, date..." value={search} onChangeText={setSearch} />
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          {["all", "unpaid", "paid"].map((s) => (
            <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
          ))}
        </View>

        {tab === "late" ? (
          filteredFines.length === 0 ? (
            <EmptyState text="No records found" />
          ) : (
            filteredFines.map((f) => (
              <FineRow key={f.id} f={f} canManage={canManage} onEdit={setEditingFine} onDelete={confirmDeleteFine} onToggle={confirmToggleFine} />
            ))
          )
        ) : filteredStandups.length === 0 ? (
          <EmptyState text="No standup records found" />
        ) : (
          filteredStandups.map((f) => (
            <FineRow key={f.id} f={f} canManage={canManage} onEdit={setEditingStandup} onDelete={confirmDeleteStandup} onToggle={confirmToggleStandup} />
          ))
        )}
      </Card>

      <Link href="/withdrawals" asChild>
        <Pressable>
          <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ color: t.textPrimary, fontWeight: "700", fontSize: 14 }}>💸 Withdrawals</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>Rs. {totalWithdrawn.toLocaleString()} withdrawn · {withdrawals.length} records</Text>
            </View>
            <Text style={{ color: t.textMuted, fontSize: 18 }}>›</Text>
          </Card>
        </Pressable>
      </Link>

      <AddFineModal isOpen={showAddFine} onClose={() => setShowAddFine(false)} />
      <EditFineModal isOpen={!!editingFine} onClose={() => setEditingFine(null)} fine={editingFine} />
      <AddStandupFineModal isOpen={showAddStandup} onClose={() => setShowAddStandup(false)} />
      <EditStandupModal isOpen={!!editingStandup} onClose={() => setEditingStandup(null)} record={editingStandup} />
    </Screen>
  );
}
