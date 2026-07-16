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
import AddFineSeasonModal from "../../components/AddFineSeasonModal";
import EditFineSeasonModal from "../../components/EditFineSeasonModal";

const UNASSIGNED = "unassigned";

function SeasonChip({ label, active, onPress, onEdit }) {
  const t = useThemeColors();
  const activeColor = t.accentIndigo;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? activeColor : t.border,
        backgroundColor: active ? activeColor + "22" : "transparent",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? activeColor : t.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      {onEdit && (
        <Pressable onPress={onEdit} style={{ marginLeft: 6 }} hitSlop={8}>
          <Text style={{ fontSize: 12 }}>✏️</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

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
  const { fines, fineSeasons, standupFines, toggleFineStatus, deleteFine, toggleStandupFineStatus, deleteStandupFine, isAdmin, isFineAdmin, withdrawals, isLoaded } = useApp();
  const t = useThemeColors();
  const canManage = isAdmin || isFineAdmin;

  const [tab, setTab] = useState("late");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddFine, setShowAddFine] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [editingStandup, setEditingStandup] = useState(null);
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);

  const sortedSeasons = useMemo(
    () => [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [fineSeasons]
  );
  const latestSeasonId = sortedSeasons[0]?.id ?? null;

  // Default to the latest season once seasons load, but only the first time
  useMemo(() => {
    if (activeSeasonId === null && latestSeasonId !== null) setActiveSeasonId(latestSeasonId);
  }, [latestSeasonId, activeSeasonId]);

  const unassignedCount = useMemo(() => fines.filter((f) => !f.season_id).length, [fines]);

  const seasonFines = useMemo(() => {
    if (activeSeasonId === UNASSIGNED) return fines.filter((f) => !f.season_id);
    return fines.filter((f) => f.season_id === activeSeasonId);
  }, [fines, activeSeasonId]);

  // Accumulation always spans every fine ever recorded, regardless of season
  const accumulatedTotal = useMemo(() => fines.reduce((s, f) => s + f.amount, 0), [fines]);
  const accumulatedUnpaid = useMemo(() => fines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0), [fines]);

  const filteredFines = useMemo(() => {
    let list = [...seasonFines];
    if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.employee_name.toLowerCase().includes(q) || f.date.includes(q) || String(f.amount).includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [seasonFines, statusFilter, search]);

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

      {tab === "late" && (
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle>💰 Fine Seasons</SectionTitle>
            {canManage && <Button title="+ Season" small variant="ghost" onPress={() => setShowAddSeason(true)} />}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {unassignedCount > 0 && (
              <SeasonChip label="🗂️ Pre Fiscal Year Fines" active={activeSeasonId === UNASSIGNED} onPress={() => setActiveSeasonId(UNASSIGNED)} />
            )}
            {sortedSeasons.length === 0 && unassignedCount === 0 ? (
              <Text style={{ color: t.textMuted, fontSize: 13 }}>No seasons yet</Text>
            ) : (
              sortedSeasons.map((s) => (
                <SeasonChip
                  key={s.id}
                  label={s.title}
                  active={activeSeasonId === s.id}
                  onPress={() => setActiveSeasonId(s.id)}
                  onEdit={canManage ? () => setEditingSeason(s) : null}
                />
              ))
            )}
          </View>
          <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>
            Accumulated total (all seasons): Rs. {accumulatedTotal.toLocaleString()} · Rs. {accumulatedUnpaid.toLocaleString()} unpaid
          </Text>
        </Card>
      )}

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
      <AddFineSeasonModal isOpen={showAddSeason} onClose={() => setShowAddSeason(false)} />
      <EditFineSeasonModal isOpen={!!editingSeason} onClose={() => setEditingSeason(null)} season={editingSeason} />
    </Screen>
  );
}
