import { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import { supabase, supabaseStandup, API_BASE_URL } from "../lib/supabase";
import { haversineMeters, computeLateness, isWorkingDay, getNepalDateStr } from "../lib/attendance";
import { registerForPushNotificationsAsync } from "../lib/pushNotifications";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [fines, setFines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [standupFines, setStandupFines] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wordSeasons, setWordSeasons] = useState([]);
  const [words, setWords] = useState([]);
  const [fineSeasons, setFineSeasons] = useState([]);
  const [leaveSeasons, setLeaveSeasons] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [standupSubmissions, setStandupSubmissions] = useState([]);
  const [standupQuestions, setStandupQuestions] = useState([]);
  const [theme, setTheme] = useState("dark");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [memories, setMemories] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [officeSettings, setOfficeSettings] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const adminEmails = [
    "sanish@heubert.com",
    "nikhil@heubert.com",
    "pranay@heubert.com",
    "pratisha@heubert.com",
    "developers@heubert.com",
  ];

  const fineAdminEmails = ["sanish@heubert.com", "developers@heubert.com"];

  const isAdmin = user ? adminEmails.includes(user.email.toLowerCase()) : false;
  const isFineAdmin = user ? fineAdminEmails.includes(user.email.toLowerCase()) : false;

  // Initial load from Supabase
  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("fines").select("*").order("date", { ascending: false }),
        supabase.from("fine_seasons").select("*").order("created_at", { ascending: true }),
        supabase.from("leaves").select("*").order("start_date", { ascending: false }),
        supabase.from("leave_seasons").select("*").order("created_at", { ascending: true }),
        supabase.from("standup_records").select("*").order("date", { ascending: false }),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
        supabase.from("word_seasons").select("*").order("created_at", { ascending: true }),
        supabase.from("words").select("*").order("created_at", { ascending: false }),
        supabase.from("public_holidays").select("*").order("date", { ascending: true }),
        supabase.from("company_events").select("*").order("date", { ascending: true }),
        supabase.from("sprints").select("*").order("created_at", { ascending: false }),
        supabaseStandup.from("standup_responses").select("*").order("date", { ascending: false }),
        supabaseStandup.from("questions").select("*").order("sort_order", { ascending: true }),
        supabase.from("memories").select("*").order("created_at", { ascending: false }),
        supabase.from("attendance").select("*").order("date", { ascending: false }),
        supabase.from("office_settings").select("*").eq("id", 1).single(),
        supabase.from("leave_types").select("*").order("sort_order", { ascending: true }),
      ]);

      const [
        { data: empData },
        { data: fineData },
        { data: fineSeasonData },
        { data: leaveData },
        { data: leaveSeasonData },
        { data: standupData },
        { data: withdrawalData },
        { data: seasonData },
        { data: wordData },
        { data: holidayData },
        { data: eventsData },
        { data: sprintsData },
        { data: standupSubData },
        { data: standupQuestData },
        { data: memoryData },
        { data: attendanceData },
        { data: officeSettingsData },
        { data: leaveTypesData },
      ] = results;

      if (empData) setEmployees(empData);
      if (fineData) setFines(fineData);
      if (fineSeasonData) setFineSeasons(fineSeasonData);
      if (leaveData) setLeaves(leaveData);
      if (leaveSeasonData) setLeaveSeasons(leaveSeasonData);
      if (standupData) setStandupFines(standupData);
      if (withdrawalData) setWithdrawals(withdrawalData);
      if (seasonData) setWordSeasons(seasonData);
      if (wordData) setWords(wordData);
      if (holidayData) setPublicHolidays(holidayData);
      if (eventsData) setCompanyEvents(eventsData);
      if (sprintsData) {
        setSprints(sprintsData);
        const active = sprintsData.find((s) => s.is_active);
        if (active) setActiveSprint(active);
      }
      if (standupSubData) setStandupSubmissions(standupSubData);
      if (standupQuestData) setStandupQuestions(standupQuestData);
      if (memoryData) setMemories(memoryData);
      if (attendanceData) setAttendance(attendanceData);
      if (officeSettingsData) setOfficeSettings(officeSettingsData);
      if (leaveTypesData) setLeaveTypes(leaveTypesData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Settings: read from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem("heubert-theme");
      setTheme(savedTheme === "light" ? "light" : "dark");

      const savedAnimations = await AsyncStorage.getItem("heubert-animations");
      if (savedAnimations !== null) {
        setAnimationsEnabled(savedAnimations === "true");
      }
    })();
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem("heubert-theme", next);
      return next;
    });
  };

  const toggleAnimations = () => {
    setAnimationsEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem("heubert-animations", next.toString());
      return next;
    });
  };

  const verifyEmployeeAccess = async (u) => {
    if (!u.email) return;

    try {
      const { data: existing, error } = await supabase
        .from("employees")
        .select("*")
        .or(`work_email.ilike.${u.email},personal_email.ilike.${u.email}`);

      if (error) {
        console.error("Error checking employee access:", error);
        await supabase.auth.signOut();
        return;
      }

      const isActiveEmployee = existing && existing.some((e) => e.status === "active");

      if (!isActiveEmployee) {
        console.log("Unauthorized access attempt. User is not an active employee:", u.email);
        await supabase.auth.signOut();
        router.replace("/login?error=unauthorized");
        return;
      }

      console.log("Employee verified:", u.email);
    } catch (err) {
      console.error("Error in verifyEmployeeAccess:", err);
      await supabase.auth.signOut();
    }
  };

  useEffect(() => {
    fetchData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        verifyEmployeeAccess(session.user);
      }
      setIsAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === "SIGNED_IN" && currentUser) {
        verifyEmployeeAccess(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  // Find the employee record that matches the current logged-in user
  useEffect(() => {
    if (user && employees.length) {
      const match = employees.find(
        (e) =>
          (e.work_email && e.work_email.toLowerCase() === user.email.toLowerCase()) ||
          (e.personal_email && e.personal_email.toLowerCase() === user.email.toLowerCase())
      );
      setCurrentEmployee(match || null);
    } else {
      setCurrentEmployee(null);
    }
  }, [user, employees]);

  // Register for push notifications once we know which employee is signed in.
  useEffect(() => {
    if (currentEmployee?.name) {
      registerForPushNotificationsAsync(currentEmployee.name);
    }
  }, [currentEmployee]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ── CRUD Helpers ─────────────────────────────────────────
  const addEmployee = async (employee) => {
    const payload = {
      name: employee.name,
      emp_no: employee.empNo,
      dob: employee.dob || null,
      joined_date: employee.joinedDate || null,
      left_date: employee.leftDate || null,
      work_email: employee.workEmail,
      personal_email: employee.personalEmail,
      phone: employee.phone,
      address: employee.address,
      status: employee.status,
    };
    const { data, error } = await supabase.from("employees").insert([payload]).select();
    if (data) setEmployees((prev) => [...prev, data[0]]);
    return { data, error };
  };

  const updateEmployee = async (id, updatedData) => {
    const payload = {
      name: updatedData.name,
      emp_no: updatedData.empNo,
      dob: updatedData.dob || null,
      joined_date: updatedData.joinedDate || null,
      left_date: updatedData.leftDate || null,
      work_email: updatedData.workEmail,
      personal_email: updatedData.personalEmail,
      phone: updatedData.phone,
      address: updatedData.address,
      status: updatedData.status,
    };
    const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select();
    if (data) setEmployees((prev) => prev.map((e) => (e.id === id ? data[0] : e)));
    return { data, error };
  };

  const removeEmployee = async (id) => {
    const employee = employees.find((e) => e.id === id);
    if (!employee) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) {
      const isSelf =
        user &&
        ((employee.work_email && employee.work_email.toLowerCase() === user.email.toLowerCase()) ||
          (employee.personal_email && employee.personal_email.toLowerCase() === user.email.toLowerCase()));

      setEmployees((prev) => prev.filter((e) => e.id !== id));
      setFines((prev) => prev.filter((f) => f.employee_name !== employee.name));
      setLeaves((prev) => prev.filter((l) => l.employee_name !== employee.name));
      setStandupFines((prev) => prev.filter((s) => s.employee_name !== employee.name));

      if (isSelf) {
        signOut();
      }
    }
    return { error };
  };

  const addFine = async (fine) => {
    const payload = {
      employee_name: fine.name,
      date: fine.date,
      amount: fine.amount,
      status: fine.status,
      season_id: fine.seasonId ?? null,
    };
    const { data, error } = await supabase.from("fines").insert([payload]).select();
    if (data) setFines((prev) => [data[0], ...prev]);
    return { data, error };
  };

  const addFineSeason = async (title) => {
    const { data, error } = await supabase.from("fine_seasons").insert([{ title, created_by: user?.email }]).select();
    if (data) setFineSeasons((prev) => [...prev, data[0]]);
    return { data, error };
  };

  const deleteFineSeason = async (id) => {
    const { error } = await supabase.from("fine_seasons").delete().eq("id", id);
    if (!error) {
      setFineSeasons((prev) => prev.filter((s) => s.id !== id));
      setFines((prev) => prev.map((f) => (f.season_id === id ? { ...f, season_id: null } : f)));
    }
    return { error };
  };

  const updateFineSeason = async (id, title) => {
    const { data, error } = await supabase.from("fine_seasons").update({ title }).eq("id", id).select();
    if (data) setFineSeasons((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
    return { data, error };
  };

  const toggleFineStatus = async (id) => {
    const fine = fines.find((f) => f.id === id);
    if (!fine) return;
    const newStatus = fine.status === "paid" ? "unpaid" : "paid";
    const { data } = await supabase.from("fines").update({ status: newStatus }).eq("id", id).select();
    if (data) setFines((prev) => prev.map((f) => (f.id === id ? data[0] : f)));
  };

  const deleteFine = async (id) => {
    const { error } = await supabase.from("fines").delete().eq("id", id);
    if (!error) setFines((prev) => prev.filter((f) => f.id !== id));
    return { error };
  };

  const updateFine = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("fines")
      .update({ amount: updatedData.amount, status: updatedData.status })
      .eq("id", id)
      .select();

    if (data) setFines((prev) => prev.map((f) => (f.id === id ? data[0] : f)));
    return { data, error };
  };

  const addLeave = async (leave) => {
    if (!leave.name || !leave.name.trim()) return { data: null, error: new Error("Employee name is required") };
    const payload = {
      employee_name: leave.name,
      start_date: leave.startDate,
      end_date: leave.endDate,
      type: leave.type,
      reason: leave.reason,
      leave_type_id: leave.leaveTypeId ?? null,
      season_id: leave.seasonId ?? null,
    };
    const { data, error } = await supabase.from("leaves").insert([payload]).select();
    if (data) setLeaves((prev) => [data[0], ...prev]);
    return { data, error };
  };

  const addLeaveSeason = async (title) => {
    const { data, error } = await supabase.from("leave_seasons").insert([{ title, created_by: user?.email }]).select();
    if (data) setLeaveSeasons((prev) => [...prev, data[0]]);
    return { data, error };
  };

  const deleteLeaveSeason = async (id) => {
    const { error } = await supabase.from("leave_seasons").delete().eq("id", id);
    if (!error) {
      setLeaveSeasons((prev) => prev.filter((s) => s.id !== id));
      setLeaves((prev) => prev.map((l) => (l.season_id === id ? { ...l, season_id: null } : l)));
    }
    return { error };
  };

  const updateLeaveSeason = async (id, title) => {
    const { data, error } = await supabase.from("leave_seasons").update({ title }).eq("id", id).select();
    if (data) setLeaveSeasons((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
    return { data, error };
  };

  const deleteLeave = async (id) => {
    const { error } = await supabase.from("leaves").delete().eq("id", id);
    if (!error) setLeaves((prev) => prev.filter((l) => l.id !== id));
    return { error };
  };

  const updateLeave = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("leaves")
      .update({
        start_date: updatedData.start_date,
        end_date: updatedData.end_date,
        type: updatedData.type,
        reason: updatedData.reason,
        leave_type_id: updatedData.leave_type_id ?? null,
      })
      .eq("id", id)
      .select();

    if (data) setLeaves((prev) => prev.map((l) => (l.id === id ? data[0] : l)));
    return { data, error };
  };

  const addLeaveType = async (leaveType) => {
    const payload = {
      name: leaveType.name,
      annual_days: leaveType.annualDays,
      is_unpaid: leaveType.isUnpaid || false,
      is_active: leaveType.isActive !== undefined ? leaveType.isActive : true,
      sort_order: leaveType.sortOrder ?? leaveTypes.length,
    };
    const { data, error } = await supabase.from("leave_types").insert([payload]).select();
    if (data) setLeaveTypes((prev) => [...prev, data[0]].sort((a, b) => a.sort_order - b.sort_order));
    return { data, error };
  };

  const updateLeaveType = async (id, updatedData) => {
    const payload = {
      name: updatedData.name,
      annual_days: updatedData.annualDays,
      is_unpaid: updatedData.isUnpaid || false,
      is_active: updatedData.isActive !== undefined ? updatedData.isActive : true,
      sort_order: updatedData.sortOrder ?? 0,
    };
    const { data, error } = await supabase.from("leave_types").update(payload).eq("id", id).select();
    if (data) setLeaveTypes((prev) => prev.map((t) => (t.id === id ? data[0] : t)).sort((a, b) => a.sort_order - b.sort_order));
    return { data, error };
  };

  const deleteLeaveType = async (id) => {
    const { error } = await supabase.from("leave_types").delete().eq("id", id);
    if (!error) setLeaveTypes((prev) => prev.filter((t) => t.id !== id));
    return { error };
  };

  const addStandupFine = async (record) => {
    const payload = { employee_name: record.name, date: record.date, status: record.status };
    const { data, error } = await supabase.from("standup_records").insert([payload]).select();
    if (data) setStandupFines((prev) => [data[0], ...prev]);
    return { data, error };
  };

  const toggleStandupFineStatus = async (id) => {
    const record = standupFines.find((s) => s.id === id);
    if (!record) return;
    const newStatus = record.status === "paid" ? "unpaid" : "paid";
    const { data } = await supabase.from("standup_records").update({ status: newStatus }).eq("id", id).select();
    if (data) setStandupFines((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
  };

  const deleteStandupFine = async (id) => {
    const { error } = await supabase.from("standup_records").delete().eq("id", id);
    if (!error) setStandupFines((prev) => prev.filter((s) => s.id !== id));
    return { error };
  };

  const updateStandupFine = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("standup_records")
      .update({ date: updatedData.date, status: updatedData.status })
      .eq("id", id)
      .select();

    if (data) setStandupFines((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
    return { data, error };
  };

  // ── Attendance ───────────────────────────────────────────
  const verifyAtOffice = async () => {
    if (!officeSettings) throw new Error("Office location isn't configured yet. Contact an admin.");

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error("Location permission is required.");

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const distance = haversineMeters(
      position.coords.latitude,
      position.coords.longitude,
      officeSettings.latitude,
      officeSettings.longitude
    );
    if (distance > officeSettings.radius_meters) {
      throw new Error(
        `You're ${Math.round(distance)}m from the office — you must be within ${officeSettings.radius_meters}m.`
      );
    }
    return position;
  };

  const verifyDeviceSecurity = async (promptMessage) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      throw new Error("Set up a fingerprint, face unlock, PIN, or pattern on your device first.");
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });
    if (!result.success) throw new Error("Verification failed.");
  };

  const checkIn = async () => {
    if (!currentEmployee) throw new Error("No employee profile is linked to your account.");

    const todayStr = getNepalDateStr(new Date());
    const existing = attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr);
    if (existing?.check_in_at) throw new Error("You've already checked in today.");

    const position = await verifyAtOffice();
    await verifyDeviceSecurity("Verify it's you to check in");

    const now = new Date();
    const { isLate, lateMinutes } = isWorkingDay(todayStr, publicHolidays)
      ? computeLateness(now, officeSettings.sync_time)
      : { isLate: false, lateMinutes: 0 };

    const payload = {
      employee_name: currentEmployee.name,
      date: todayStr,
      check_in_at: now.toISOString(),
      check_in_lat: position.coords.latitude,
      check_in_lng: position.coords.longitude,
      is_late: isLate,
      late_minutes: lateMinutes,
    };

    const { data, error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "employee_name,date" })
      .select()
      .single();
    if (error) throw error;

    setAttendance((prev) => [data, ...prev.filter((a) => a.id !== data.id)]);

    if (isLate) {
      await addFine({
        name: currentEmployee.name,
        date: todayStr,
        amount: officeSettings.late_fine_amount,
        status: "unpaid",
      });
    }

    return data;
  };

  const checkOut = async () => {
    if (!currentEmployee) throw new Error("No employee profile is linked to your account.");

    const todayStr = getNepalDateStr(new Date());
    const existing = attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr);
    if (!existing?.check_in_at) throw new Error("You need to check in before checking out.");
    if (existing.check_out_at) throw new Error("You've already checked out today.");

    const position = await verifyAtOffice();
    await verifyDeviceSecurity("Verify it's you to check out");

    const now = new Date();
    const { data, error } = await supabase
      .from("attendance")
      .update({
        check_out_at: now.toISOString(),
        check_out_lat: position.coords.latitude,
        check_out_lng: position.coords.longitude,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;

    setAttendance((prev) => prev.map((a) => (a.id === existing.id ? data : a)));
    return data;
  };

  const updateOfficeSettings = async (patch) => {
    const payload = { id: 1, ...officeSettings, ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("office_settings").upsert(payload).select().single();
    if (data) setOfficeSettings(data);
    return { data, error };
  };

  const addWithdrawal = async (amount, reason) => {
    const withdrawnBy = user?.user_metadata?.full_name || user?.email || "Admin";
    const payload = { amount, reason, withdrawn_by: withdrawnBy };
    const { data, error } = await supabase.from("withdrawals").insert([payload]).select();
    if (error) throw error;
    if (data) setWithdrawals((prev) => [data[0], ...prev]);
  };

  const deleteWithdrawal = async (id) => {
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);
    if (!error) setWithdrawals((prev) => prev.filter((w) => w.id !== id));
    return { error };
  };

  const addWordSeason = async (title) => {
    const { data, error } = await supabase
      .from("word_seasons")
      .insert([{ title, created_by: user?.email }])
      .select();
    if (data) setWordSeasons((prev) => [...prev, data[0]]);
    return { data, error };
  };

  const deleteWordSeason = async (id) => {
    const { error } = await supabase.from("word_seasons").delete().eq("id", id);
    if (!error) {
      setWordSeasons((prev) => prev.filter((s) => s.id !== id));
      setWords((prev) => prev.filter((w) => w.season_id !== id));
    }
    return { error };
  };

  const updateWordSeason = async (id, title) => {
    const { data, error } = await supabase.from("word_seasons").update({ title }).eq("id", id).select();
    if (data) setWordSeasons((prev) => prev.map((s) => (s.id === id ? data[0] : s)));
    return { data, error };
  };

  const addWord = async (wordData) => {
    const payload = {
      season_id: wordData.seasonId,
      word: wordData.word,
      phonetic: wordData.phonetic,
      definition: wordData.definition,
      example: wordData.example,
      translation: wordData.translation,
      created_by: user?.user_metadata?.full_name || user?.email,
    };
    const { data, error } = await supabase.from("words").insert([payload]).select();
    if (data) setWords((prev) => [data[0], ...prev]);
    return { data, error };
  };

  const deleteWord = async (id) => {
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (!error) setWords((prev) => prev.filter((w) => w.id !== id));
    return { error };
  };

  const updateWord = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("words")
      .update({
        word: updatedData.word,
        phonetic: updatedData.phonetic,
        definition: updatedData.definition,
        example: updatedData.example,
        translation: updatedData.translation,
      })
      .eq("id", id)
      .select();

    if (data) setWords((prev) => prev.map((w) => (w.id === id ? data[0] : w)));
    return { data, error };
  };

  const addPublicHoliday = async (date, title) => {
    const { data, error } = await supabase.from("public_holidays").insert([{ date, title }]).select();
    if (data) setPublicHolidays((prev) => [...prev, data[0]]);
    return { data, error };
  };

  const deletePublicHoliday = async (id) => {
    const { error } = await supabase.from("public_holidays").delete().eq("id", id);
    if (!error) setPublicHolidays((prev) => prev.filter((h) => h.id !== id));
    return { error };
  };

  const addCompanyEvent = async (date, title) => {
    const { data, error } = await supabase.from("company_events").insert([{ date, title }]).select();
    if (data) {
      setCompanyEvents((prev) => [...prev, data[0]]);
      fetch(`${API_BASE_URL}/api/notify-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, excludeEmployeeName: currentEmployee?.name }),
      }).catch((err) => console.error("notify-event error:", err));
    }
    return { data, error };
  };

  const deleteCompanyEvent = async (id) => {
    const { error } = await supabase.from("company_events").delete().eq("id", id);
    if (!error) setCompanyEvents((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  const updateCompanyEvent = async (id, date, title) => {
    const { data, error } = await supabase.from("company_events").update({ date, title }).eq("id", id).select();
    if (data) setCompanyEvents((prev) => prev.map((e) => (e.id === id ? data[0] : e)));
    return { data, error };
  };

  const addMemory = async (memory) => {
    const payload = {
      type: memory.type,
      content: memory.content,
      caption: memory.caption || "",
      author_name: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Team Member",
      author_email: user?.email,
    };
    const { data, error } = await supabase.from("memories").insert([payload]).select();
    if (error) throw error;
    if (data) setMemories((prev) => [data[0], ...prev]);
    return { data, error };
  };

  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const deleteMemory = async (id) => {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/memories?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Delete failed");
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMemory = async (id, updates) => {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/memories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Update failed");
    setMemories((prev) => prev.map((m) => (m.id === id ? json.data : m)));
    return { data: json.data };
  };

  const getEmployeeStats = useCallback(
    (name) => {
      const empFines = fines.filter((f) => f.employee_name === name);
      const total = empFines.reduce((s, f) => s + f.amount, 0);
      const paid = empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
      const unpaid = total - paid;
      return { total, paid, unpaid, records: empFines.length };
    },
    [fines]
  );

  const calculateCapacity = useCallback(
    (employeeName, startDateStr, endDateStr) => {
      let totalHours = 0;
      let current = parseLocalDate(startDateStr);

      while (toDateStr(current) <= endDateStr) {
        const dateStr = toDateStr(current);
        const dayOfWeek = current.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          current.setDate(current.getDate() + 1);
          continue;
        }
        if (publicHolidays.some((h) => h.date === dateStr)) {
          current.setDate(current.getDate() + 1);
          continue;
        }
        if (
          leaves.some(
            (l) => l.employee_name === employeeName && dateStr >= l.start_date && dateStr <= l.end_date
          )
        ) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        totalHours += dayOfWeek === 5 ? 5 : 6;
        current.setDate(current.getDate() + 1);
      }
      return totalHours;
    },
    [publicHolidays, leaves]
  );

  const calculateSprintRange = (startDateStr) => {
    let date = parseLocalDate(startDateStr);
    let workingDays = 1;
    while (workingDays < 10) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays++;
      }
    }
    return { start: startDateStr, end: toDateStr(date) };
  };

  const addSprint = async (startDate, title) => {
    const { start, end } = calculateSprintRange(startDate);
    await supabase.from("sprints").update({ is_active: false }).neq("id", 0);
    const { data, error } = await supabase
      .from("sprints")
      .insert([{ start_date: start, end_date: end, title, is_active: true }])
      .select();
    if (data) {
      setSprints((prev) => [data[0], ...prev.map((s) => ({ ...s, is_active: false }))]);
      setActiveSprint(data[0]);
    }
    return { data, error };
  };

  return (
    <AppContext.Provider
      value={{
        fines,
        employees,
        leaves,
        standupFines,
        standupSubmissions,
        standupQuestions,
        withdrawals,
        wordSeasons,
        words,
        publicHolidays,
        companyEvents,
        isLoaded,
        addEmployee,
        updateEmployee,
        removeEmployee,
        addFine,
        toggleFineStatus,
        deleteFine,
        updateFine,
        fineSeasons,
        addFineSeason,
        deleteFineSeason,
        updateFineSeason,
        getEmployeeStats,
        addLeave,
        deleteLeave,
        updateLeave,
        leaveSeasons,
        addLeaveSeason,
        deleteLeaveSeason,
        updateLeaveSeason,
        addStandupFine,
        toggleStandupFineStatus,
        deleteStandupFine,
        updateStandupFine,
        addWithdrawal,
        deleteWithdrawal,
        addWordSeason,
        deleteWordSeason,
        updateWordSeason,
        addWord,
        deleteWord,
        updateWord,
        addPublicHoliday,
        deletePublicHoliday,
        addCompanyEvent,
        deleteCompanyEvent,
        updateCompanyEvent,
        sprints,
        activeSprint,
        addSprint,
        calculateCapacity,
        user,
        isAuthReady,
        signOut,
        currentEmployee,
        isAdmin,
        isFineAdmin,
        theme,
        toggleTheme,
        animationsEnabled,
        toggleAnimations,
        memories,
        addMemory,
        deleteMemory,
        updateMemory,
        attendance,
        officeSettings,
        checkIn,
        checkOut,
        updateOfficeSettings,
        leaveTypes,
        addLeaveType,
        updateLeaveType,
        deleteLeaveType,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

// Local helpers (avoids a circular import with lib/utils.js)
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
