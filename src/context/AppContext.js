"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, supabaseStandup } from "@/lib/supabase";
import { useDialog } from "@/context/DialogContext";
import { wordSeedSeasons, wordSeedWords } from "@/data/wordSeedData";
import {
  findExistingLateFine,
  findExistingPublicHoliday,
  findLeaveConflict,
  describeLeave,
  buildWorkingDates,
  parseHalfDaySegment,
} from "@/lib/utils";
import { getNepalDateStr, computeLateness, isWorkingDay, haversineMeters } from "@/lib/attendanceTime";

// The startup fetch pulls ~22 tables. Firing them all at once opens ~22 TLS connections
// to the same host in one burst, and a subset of those reliably stall for minutes before
// completing. Six in flight keeps the load fast without triggering it.
const STARTUP_CONCURRENCY = 6;
// No query here should ever take this long. A stalled one used to hang Promise.all
// forever, which left isLoaded false and the app on its loading screen indefinitely.
const QUERY_TIMEOUT_MS = 12000;

// Resolves to a supabase-shaped { data, error } no matter what, so one bad table can
// never take the whole load down with it.
function settleQuery(label, run) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ data: null, error: { message: `Timed out after ${QUERY_TIMEOUT_MS}ms` }, label, timedOut: true }),
      QUERY_TIMEOUT_MS
    );
    Promise.resolve()
      .then(run)
      .then(
        (res) => resolve({ ...res, label }),
        (err) => resolve({ data: null, error: { message: err?.message || String(err) }, label })
      )
      .finally(() => clearTimeout(timer));
  });
}

// Runs the thunks at most `limit` at a time, preserving result order.
async function runPooled(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// The season a new record belongs to: the most recently CREATED one. Callers may omit a
// season (e.g. the attendance auto-fine) and must still land on the current season rather
// than null, which would file the record in the pre-season bucket and hide it from the
// season-scoped views.
function latestSeasonId(seasons) {
  if (!seasons || seasons.length === 0) return null;
  return [...seasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id;
}

// Working days a leave actually covers, with weekends and public holidays removed — the
// same basis the balances and calendar use, so a clash means the same thing everywhere.
function leaveWorkingDates(leave, publicHolidays) {
  const holidaySet = new Set(
    (publicHolidays || []).map((h) => String(h.date).split("T")[0])
  );
  const startDate = String(leave.startDate || leave.start_date || "").split("T")[0];
  const endDate = String(
    leave.endDate || leave.end_date || leave.startDate || leave.start_date || ""
  ).split("T")[0];
  return { holidaySet, dates: buildWorkingDates(startDate, endDate, holidaySet) };
}

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

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { confirmDialog, alertDialog } = useDialog();
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
  const [isSyncing, setIsSyncing] = useState(false);
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
  const [projects, setProjects] = useState([]);
  const [projectLinks, setProjectLinks] = useState([]);
  const [projectEnvironments, setProjectEnvironments] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);

  const adminEmails = [
    "sanish@heubert.com",
    "nikhil@heubert.com",
    "pranay@heubert.com",
    "pratisha@heubert.com",
    "developers@heubert.com"
  ];

  const fineAdminEmails = [
    "sanish@heubert.com",
    "developers@heubert.com"
  ];

  const isAdmin = user ? adminEmails.includes(user.email.toLowerCase()) : false;
  const isFineAdmin = user ? fineAdminEmails.includes(user.email.toLowerCase()) : false;
  const canPunchAttendance = currentEmployee?.can_punch_web === true;

  // Initial load from Supabase
  const fetchData = useCallback(async () => {
    // One entry per table — how to fetch it, and where its rows land. Held as data so the
    // load can be pooled and a straggler retried without disturbing everything else.
    const queries = [
      ["employees", () => supabase.from("employees").select("*").order("name"), setEmployees],
      ["fines", () => supabase.from("fines").select("*").order("date", { ascending: false }), setFines],
      ["fine_seasons", () => supabase.from("fine_seasons").select("*").order("created_at", { ascending: true }), setFineSeasons],
      ["leaves", () => supabase.from("leaves").select("*").order("start_date", { ascending: false }), setLeaves],
      ["leave_seasons", () => supabase.from("leave_seasons").select("*").order("created_at", { ascending: true }), setLeaveSeasons],
      ["standup_records", () => supabase.from("standup_records").select("*").order("date", { ascending: false }), setStandupFines],
      ["withdrawals", () => supabase.from("withdrawals").select("*").order("created_at", { ascending: false }), setWithdrawals],
      ["word_seasons", () => supabase.from("word_seasons").select("*").order("created_at", { ascending: true }), setWordSeasons],
      ["words", () => supabase.from("words").select("*").order("created_at", { ascending: false }), setWords],
      ["public_holidays", () => supabase.from("public_holidays").select("*").order("date", { ascending: true }), setPublicHolidays],
      ["company_events", () => supabase.from("company_events").select("*").order("date", { ascending: true }), setCompanyEvents],
      ["sprints", () => supabase.from("sprints").select("*").order("created_at", { ascending: false }), (rows) => {
        setSprints(rows);
        const active = rows.find(s => s.is_active);
        if (active) setActiveSprint(active);
      }],
      ["standup_responses", () => supabaseStandup.from("standup_responses").select("*").order("date", { ascending: false }), setStandupSubmissions],
      ["questions", () => supabaseStandup.from("questions").select("*").order("sort_order", { ascending: true }), setStandupQuestions],
      ["memories", () => supabase.from("memories").select("*").order("created_at", { ascending: false }), setMemories],
      ["attendance", () => supabase.from("attendance").select("*").order("date", { ascending: false }), setAttendance],
      ["office_settings", () => supabase.from("office_settings").select("*").eq("id", 1).single(), setOfficeSettings],
      ["leave_types", () => supabase.from("leave_types").select("*").order("sort_order", { ascending: true }), setLeaveTypes],
      ["projects", () => supabase.from("projects").select("*").order("name"), setProjects],
      ["project_links", () => supabase.from("project_links").select("*").order("sort_order", { ascending: true }), setProjectLinks],
      ["project_environments", () => supabase.from("project_environments").select("*").order("sort_order", { ascending: true }), setProjectEnvironments],
      ["project_members", () => supabase.from("project_members").select("*"), setProjectMembers],
    ];

    const apply = ([label, , store], result) => {
      if (result.error) console.warn(`Startup load for ${label} failed: ${result.error.message}`);
      if (result.data) store(result.data);
    };

    try {
      const results = await runPooled(
        queries.map(([label, run]) => () => settleQuery(label, run)),
        STARTUP_CONCURRENCY
      );
      results.forEach((res, i) => apply(queries[i], res));

      // Only stalls get a second chance — a table that answered with a real error will
      // just answer with it again. The app is already past its loading screen by now, so
      // a slow table fills itself in instead of holding the whole UI hostage.
      const stalled = queries.filter((_, i) => results[i].timedOut);
      if (stalled.length) {
        runPooled(
          stalled.map(([label, run]) => () => settleQuery(label, run)),
          STARTUP_CONCURRENCY
        ).then((retried) => retried.forEach((res, i) => apply(stalled[i], res)));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Settings: read from localStorage on mount
  useEffect(() => {
    // Theme
    const savedTheme = typeof window !== "undefined" ? localStorage.getItem("heubert-theme") : null;
    const initialTheme = savedTheme === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);

    // Animations
    const savedAnimations = typeof window !== "undefined" ? localStorage.getItem("heubert-animations") : null;
    if (savedAnimations !== null) {
      setAnimationsEnabled(savedAnimations === "true");
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("heubert-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  };

  const toggleAnimations = () => {
    setAnimationsEnabled(prev => {
      const next = !prev;
      localStorage.setItem("heubert-animations", next.toString());
      return next;
    });
  };

  useEffect(() => {
    fetchData();

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        verifyEmployeeAccess(session.user);
      }
      setIsAuthReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (event === "SIGNED_IN" && currentUser) {
        verifyEmployeeAccess(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  const verifyEmployeeAccess = async (u) => {
    if (!u.email) return;

    try {
      // 1. Check if employee already exists by email (case-insensitive)
      const { data: existing, error } = await supabase
        .from("employees")
        .select("*")
        .or(`work_email.ilike.${u.email},personal_email.ilike.${u.email}`);

      if (error) {
        console.error("Error checking employee access:", error);
        await supabase.auth.signOut();
        return;
      }

      // If not exists or not active, sign them out
      const isActiveEmployee = existing && existing.some(e => e.status === "active");

      if (!isActiveEmployee) {
        console.log("Unauthorized access attempt. User is not an active employee:", u.email);
        await supabase.auth.signOut();
        window.location.href = "/login?error=unauthorized";
        return;
      }

      console.log("Employee verified:", u.email);
    } catch (err) {
      console.error("Error in verifyEmployeeAccess:", err);
      await supabase.auth.signOut();
    }
  };

  // Find the employee record matches the current logged-in user
  useEffect(() => {
    if (user && employees.length) {
      const match = employees.find(e => 
        (e.work_email && e.work_email.toLowerCase() === user.email.toLowerCase()) ||
        (e.personal_email && e.personal_email.toLowerCase() === user.email.toLowerCase())
      );
      setCurrentEmployee(match || null);
    } else {
      setCurrentEmployee(null);
    }
  }, [user, employees]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const syncLocalToCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const localEmps = JSON.parse(localStorage.getItem("penalty_employees") || "[]");
      const localFines = JSON.parse(localStorage.getItem("penalty_fines") || "[]");
      const localLeaves = JSON.parse(localStorage.getItem("penalty_leaves") || "[]");
      const localStandup = JSON.parse(localStorage.getItem("penalty_standup") || "[]");

      // Migration mapping: local employees might be strings or objects
      const empsToUpload = localEmps.map((e, idx) => {
        if (typeof e === "string") {
            return { name: e, status: "active", emp_no: `EMP-${idx+1}` };
        }
        return {
            name: e.name,
            emp_no: e.empNo,
            dob: e.dob || null,
            joined_date: e.joinedDate || null,
            left_date: e.leftDate || null,
            work_email: e.workEmail,
            personal_email: e.personalEmail,
            phone: e.phone,
            address: e.address,
            status: e.status
        };
      });

      if (empsToUpload.length) {
          await supabase.from("employees").upsert(empsToUpload, { onConflict: "name" });
      }

      const finesToUpload = localFines.map(f => ({
          employee_name: f.name,
          date: f.date,
          amount: f.amount,
          status: f.status
      }));
      if (finesToUpload.length) await supabase.from("fines").insert(finesToUpload);

      const leavesToUpload = localLeaves.map(l => ({
          employee_name: l.name,
          start_date: l.startDate,
          end_date: l.endDate,
          type: l.type,
          reason: l.reason
      }));
      if (leavesToUpload.length) await supabase.from("leaves").insert(leavesToUpload);

      const standupToUpload = localStandup.map(s => ({
          employee_name: s.name,
          date: s.date,
          status: s.status
      }));
      if (standupToUpload.length) await supabase.from("standup_records").insert(standupToUpload);

      await alertDialog("Sync complete! Please refresh the page.", { tone: "success" });
      fetchData();
    } catch (err) {
      console.error("Sync error:", err);
      await alertDialog("Error during sync. See console.", { tone: "error" });
    } finally {
      setIsSyncing(false);
    }
  }, [fetchData]);

  // CRUD Helpers
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
        status: employee.status
    };
    const { data, error } = await supabase.from("employees").insert([payload]).select();
    if (data) setEmployees(prev => [...prev, data[0]]);
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
        status: updatedData.status
    };
    const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select();
    if (data) setEmployees(prev => prev.map(e => e.id === id ? data[0] : e));
    return { data, error };
  };

  // Freelance/WFH web punch access — unrestricted, no office geofence. Turning it on
  // always clears web_punch_office_bound, so an employee is only ever in one category.
  const setEmployeePunchAccess = async (id, canPunchWeb) => {
    const payload = canPunchWeb
      ? { can_punch_web: true, web_punch_office_bound: false }
      : { can_punch_web: false };
    const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select();
    if (data) setEmployees(prev => prev.map(e => e.id === id ? data[0] : e));
    return { data, error };
  };

  // On-site employees who still want to punch from the tracker website instead of the
  // mobile app — same web punch flow, but bound to the office geofence like mobile is.
  const setEmployeeOfficeBoundPunch = async (id, enabled) => {
    const payload = enabled
      ? { can_punch_web: true, web_punch_office_bound: true }
      : { can_punch_web: false, web_punch_office_bound: false };
    const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select();
    if (data) setEmployees(prev => prev.map(e => e.id === id ? data[0] : e));
    return { data, error };
  };

  const removeEmployee = async (id) => {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) {
      // If the deleted employee is the current user, sign out
      const isSelf = user && (
        (employee.work_email && employee.work_email.toLowerCase() === user.email.toLowerCase()) ||
        (employee.personal_email && employee.personal_email.toLowerCase() === user.email.toLowerCase())
      );

      setEmployees(prev => prev.filter(e => e.id !== id));
      // Cascade deletions in local state
      setFines(prev => prev.filter(f => f.employee_name !== employee.name));
      setLeaves(prev => prev.filter(l => l.employee_name !== employee.name));
      setStandupFines(prev => prev.filter(s => s.employee_name !== employee.name));

      if (isSelf) {
        console.log("Deleted own record. Signing out...");
        signOut();
      }
    }
    return { error };
  };

  const addFine = async (fine) => {
    // One late fine per person per day, regardless of amount — being late is a single
    // event, so a second fine for the same day is always a duplicate. Enforced here so
    // every entry point (main page, meeting quick-add, mobile) is covered.
    const existing = findExistingLateFine(fines, fine.name, fine.date);
    if (existing) {
      return {
        data: null,
        error: new Error(
          `${fine.name} already has a Rs ${existing.amount} late fine on ${String(existing.date).split("T")[0]}. Late fines are one per person per day — edit or delete the existing one instead.`
        ),
      };
    }

    const payload = {
        employee_name: fine.name,
        date: fine.date,
        amount: fine.amount,
        status: fine.status,
        season_id: fine.seasonId ?? latestSeasonId(fineSeasons)
    };
    const { data, error } = await supabase.from("fines").insert([payload]).select();
    if (data) setFines(prev => [data[0], ...prev]);
    return { data, error };
  };

  const toggleFineStatus = async (id) => {
    const fine = fines.find(f => f.id === id);
    if (!fine) return;
    const newStatus = fine.status === "paid" ? "unpaid" : "paid";
    const { data } = await supabase.from("fines").update({ status: newStatus }).eq("id", id).select();
    if (data) setFines(prev => prev.map(f => f.id === id ? data[0] : f));
  };

  const deleteFine = async (id) => {
    const { error } = await supabase.from("fines").delete().eq("id", id);
    if (!error) setFines(prev => prev.filter(f => f.id !== id));
  };

  const updateFine = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("fines")
      .update({
        amount: updatedData.amount,
        status: updatedData.status
      })
      .eq("id", id)
      .select();

    if (data) {
      setFines(prev => prev.map(f => f.id === id ? data[0] : f));
    }
    return { data, error };
  };

  const addFineSeason = async (title) => {
    const { data, error } = await supabase.from("fine_seasons").insert([{ title, created_by: user?.email }]).select();
    if (data) setFineSeasons(prev => [...prev, data[0]]);
    return { data, error };
  };

  const deleteFineSeason = async (id) => {
    const { error } = await supabase.from("fine_seasons").delete().eq("id", id);
    if (!error) {
      setFineSeasons(prev => prev.filter(s => s.id !== id));
      // Fines keep accumulating regardless of season — only clear their season_id (mirrors ON DELETE SET NULL)
      setFines(prev => prev.map(f => f.season_id === id ? { ...f, season_id: null } : f));
    }
    return { error };
  };

  const updateFineSeason = async (id, title) => {
    const { data, error } = await supabase.from("fine_seasons").update({ title }).eq("id", id).select();
    if (data) setFineSeasons(prev => prev.map(s => s.id === id ? data[0] : s));
    return { data, error };
  };

  const addLeave = async (leave) => {
    if (!leave.name || !leave.name.trim()) return { data: null, error: new Error("Employee name is required") };

    // One leave per person per working day. A full-day or early leave takes the whole day,
    // so nothing else can be booked on it; two half-days only coexist when they cover
    // opposite halves. Enforced here so every entry point (leave modal, meeting quick-add)
    // is covered rather than each form re-implementing it.
    const { holidaySet, dates } = leaveWorkingDates(leave, publicHolidays);
    const clash = findLeaveConflict({
      employeeName: leave.name,
      dates,
      type: leave.type,
      segment: parseHalfDaySegment({ type: leave.type, reason: leave.reason }),
      leaves,
      holidaySet,
    });
    if (clash) {
      return {
        data: null,
        error: new Error(
          `${leave.name} already has a ${describeLeave(clash.leave)} on ${clash.date}. One leave per person per day — edit or delete the existing one instead.`
        ),
      };
    }

    const payload = {
        employee_name: leave.name,
        start_date: leave.startDate,
        end_date: leave.endDate,
        type: leave.type,
        reason: leave.reason,
        leave_type_id: leave.leaveTypeId ?? null,
        season_id: leave.seasonId ?? latestSeasonId(leaveSeasons),
    };
    const { data, error } = await supabase.from("leaves").insert([payload]).select();
    if (data) setLeaves(prev => [data[0], ...prev]);
    return { data, error };
  };

  const deleteLeave = async (id) => {
    const { error } = await supabase.from("leaves").delete().eq("id", id);
    if (!error) setLeaves(prev => prev.filter(l => l.id !== id));
  };

  const updateLeave = async (id, updatedData) => {
    // Same one-per-day rule as addLeave, or editing a leave onto an occupied date would be
    // a way straight around it. The record being edited is excluded from its own check.
    const { holidaySet, dates } = leaveWorkingDates(updatedData, publicHolidays);
    const clash = findLeaveConflict({
      employeeName: updatedData.employee_name ?? leaves.find((l) => l.id === id)?.employee_name,
      dates,
      type: updatedData.type,
      segment: parseHalfDaySegment({ type: updatedData.type, reason: updatedData.reason }),
      leaves,
      holidaySet,
      ignoreLeaveId: id,
    });
    if (clash) {
      return {
        data: null,
        error: new Error(
          `That clashes with an existing ${describeLeave(clash.leave)} on ${clash.date}. One leave per person per day.`
        ),
      };
    }

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

    if (data) {
      setLeaves(prev => prev.map(l => l.id === id ? data[0] : l));
    }
    return { data, error };
  };

  const addLeaveSeason = async (title) => {
    const { data, error } = await supabase.from("leave_seasons").insert([{ title, created_by: user?.email }]).select();
    if (data) setLeaveSeasons(prev => [...prev, data[0]]);
    return { data, error };
  };

  const deleteLeaveSeason = async (id) => {
    const { error } = await supabase.from("leave_seasons").delete().eq("id", id);
    if (!error) {
      setLeaveSeasons(prev => prev.filter(s => s.id !== id));
      // Leave history keeps accumulating regardless of season — only clear their season_id (mirrors ON DELETE SET NULL)
      setLeaves(prev => prev.map(l => l.season_id === id ? { ...l, season_id: null } : l));
    }
    return { error };
  };

  const updateLeaveSeason = async (id, title) => {
    const { data, error } = await supabase.from("leave_seasons").update({ title }).eq("id", id).select();
    if (data) setLeaveSeasons(prev => prev.map(s => s.id === id ? data[0] : s));
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
    if (data) setLeaveTypes(prev => [...prev, data[0]].sort((a, b) => a.sort_order - b.sort_order));
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
    if (data) setLeaveTypes(prev => prev.map(t => t.id === id ? data[0] : t).sort((a, b) => a.sort_order - b.sort_order));
    return { data, error };
  };

  const deleteLeaveType = async (id) => {
    const { error } = await supabase.from("leave_types").delete().eq("id", id);
    if (!error) setLeaveTypes(prev => prev.filter(t => t.id !== id));
    return { error };
  };

  // ===== PROJECTS =====
  // A project's links and environments are submitted together with the project itself,
  // so the child rows are diffed against what is already stored: rows the admin kept are
  // updated in place, new ones inserted, removed ones deleted. Delete-all-then-reinsert
  // would be shorter but loses every row for the project if one insert fails.
  const syncProjectChildren = async (table, projectId, rows, buildPayload, existingRows) => {
    const keptIds = rows.map(r => r.id).filter(Boolean);
    const staleIds = existingRows.filter(r => !keptIds.includes(r.id)).map(r => r.id);
    if (staleIds.length > 0) {
      const { error } = await supabase.from(table).delete().in("id", staleIds);
      if (error) return { error };
    }
    for (const [index, row] of rows.entries()) {
      const payload = { ...buildPayload(row, index), project_id: projectId };
      const { error } = row.id
        ? await supabase.from(table).update(payload).eq("id", row.id)
        : await supabase.from(table).insert([payload]);
      if (error) return { error };
    }
    return { error: null };
  };

  // Child rows are re-read after a write instead of patched in locally: sort_order and
  // generated ids come from the DB, and a partial failure then shows the real state.
  const reloadProjectChildren = async (table, setter, projectId) => {
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    setter(prev => [...prev.filter(r => r.project_id !== projectId), ...(data || [])]);
  };

  const projectLinkPayload = (link, index) => ({
    label: link.label.trim(),
    url: link.url.trim(),
    category: link.category || "other",
    sort_order: index,
  });

  const projectEnvPayload = (env, index) => ({
    name: env.name.trim(),
    url: (env.url || "").trim() || null,
    branch: (env.branch || "").trim() || null,
    notes: (env.notes || "").trim() || null,
    sort_order: index,
  });

  const projectPayload = (project) => ({
    name: project.name.trim(),
    client: (project.client || "").trim() || null,
    description: (project.description || "").trim() || null,
    status: project.status || "active",
    tech_stack: (project.techStack || "").trim() || null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
  });

  const sortProjectsByName = (a, b) => a.name.localeCompare(b.name);

  // Membership rows carry no editable fields of their own — an employee is either
  // staffed on the project or not — so this diffs the selected employee ids against
  // what's already stored instead of reusing the label/url row-editor sync above.
  const syncProjectMembers = async (projectId, employeeIds, existingRows) => {
    const existingEmployeeIds = existingRows.map(r => r.employee_id);
    const toAdd = employeeIds.filter(id => !existingEmployeeIds.includes(id));
    const toRemove = existingRows.filter(r => !employeeIds.includes(r.employee_id));
    if (toRemove.length > 0) {
      const { error } = await supabase.from("project_members").delete().in("id", toRemove.map(r => r.id));
      if (error) return { error };
    }
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from("project_members")
        .insert(toAdd.map(employee_id => ({ project_id: projectId, employee_id })));
      if (error) return { error };
    }
    return { error: null };
  };

  const reloadProjectMembers = async (projectId) => {
    const { data } = await supabase.from("project_members").select("*").eq("project_id", projectId);
    setProjectMembers(prev => [...prev.filter(r => r.project_id !== projectId), ...(data || [])]);
  };

  const addProject = async (project) => {
    const payload = { ...projectPayload(project), created_by: user?.email || null };
    const { data, error } = await supabase.from("projects").insert([payload]).select();
    if (error) return { error };
    const created = data[0];
    setProjects(prev => [...prev, created].sort(sortProjectsByName));

    const { error: linkError } = await syncProjectChildren(
      "project_links", created.id, project.links || [], projectLinkPayload, []
    );
    const { error: envError } = await syncProjectChildren(
      "project_environments", created.id, project.environments || [], projectEnvPayload, []
    );
    const { error: memberError } = await syncProjectMembers(created.id, project.members || [], []);
    await reloadProjectChildren("project_links", setProjectLinks, created.id);
    await reloadProjectChildren("project_environments", setProjectEnvironments, created.id);
    await reloadProjectMembers(created.id);
    return { data: created, error: linkError || envError || memberError || null };
  };

  const updateProject = async (id, project) => {
    const payload = { ...projectPayload(project), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("projects").update(payload).eq("id", id).select();
    if (error) return { error };
    if (data) setProjects(prev => prev.map(p => (p.id === id ? data[0] : p)).sort(sortProjectsByName));

    const { error: linkError } = await syncProjectChildren(
      "project_links", id, project.links || [], projectLinkPayload,
      projectLinks.filter(l => l.project_id === id)
    );
    const { error: envError } = await syncProjectChildren(
      "project_environments", id, project.environments || [], projectEnvPayload,
      projectEnvironments.filter(e => e.project_id === id)
    );
    const { error: memberError } = await syncProjectMembers(
      id, project.members || [], projectMembers.filter(m => m.project_id === id)
    );
    await reloadProjectChildren("project_links", setProjectLinks, id);
    await reloadProjectChildren("project_environments", setProjectEnvironments, id);
    await reloadProjectMembers(id);
    return { data: data?.[0], error: linkError || envError || memberError || null };
  };

  const deleteProject = async (id) => {
    // project_links / project_environments / project_members are removed by the DB's
    // ON DELETE CASCADE.
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== id));
      setProjectLinks(prev => prev.filter(l => l.project_id !== id));
      setProjectEnvironments(prev => prev.filter(e => e.project_id !== id));
      setProjectMembers(prev => prev.filter(m => m.project_id !== id));
    }
    return { error };
  };

  const addStandupFine = async (record) => {
    const payload = {
        employee_name: record.name,
        date: record.date,
        status: record.status
    };
    const { data } = await supabase.from("standup_records").insert([payload]).select();
    if (data) setStandupFines(prev => [data[0], ...prev]);
  };

  const toggleStandupFineStatus = async (id) => {
    const record = standupFines.find(s => s.id === id);
    if (!record) return;
    const newStatus = record.status === "paid" ? "unpaid" : "paid";
    const { data } = await supabase.from("standup_records").update({ status: newStatus }).eq("id", id).select();
    if (data) setStandupFines(prev => prev.map(s => s.id === id ? data[0] : s));
  };

  const deleteStandupFine = async (id) => {
    const { error } = await supabase.from("standup_records").delete().eq("id", id);
    if (!error) setStandupFines(prev => prev.filter(s => s.id !== id));
    return { error };
  };

  const updateStandupFine = async (id, updatedData) => {
    const { data, error } = await supabase
      .from("standup_records")
      .update({
        date: updatedData.date,
        status: updatedData.status
      })
      .eq("id", id)
      .select();

    if (data) {
      setStandupFines(prev => prev.map(s => s.id === id ? data[0] : s));
    }
    return { data, error };
  };

  const submitStandupResponse = async (payload) => {
    const { data, error } = await supabaseStandup.from("standup_responses").insert([payload]).select();
    if (data) setStandupSubmissions(prev => [data[0], ...prev]);
    return { data, error };
  };

  const updateStandupResponse = async (id, payload) => {
    const { data, error } = await supabaseStandup.from("standup_responses").update(payload).eq("id", id).select();
    if (data) setStandupSubmissions(prev => prev.map(s => s.id === id ? data[0] : s));
    return { data, error };
  };

  const addWithdrawal = async (amount, reason) => {
    const withdrawnBy = user?.user_metadata?.full_name || user?.email || "Admin";
    const payload = { amount, reason, withdrawn_by: withdrawnBy };
    const { data, error } = await supabase.from("withdrawals").insert([payload]).select();
    if (error) throw error;
    if (data) setWithdrawals(prev => [data[0], ...prev]);
  };

  const deleteWithdrawal = async (id) => {
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);
    if (!error) setWithdrawals(prev => prev.filter(w => w.id !== id));
  };

  const addWordSeason = async (title) => {
    const { data, error } = await supabase.from("word_seasons").insert([{ title, created_by: user?.email }]).select();
    if (data) setWordSeasons(prev => [...prev, data[0]]);
    return { data, error };
  };

  const deleteWordSeason = async (id) => {
    const { error } = await supabase.from("word_seasons").delete().eq("id", id);
    if (!error) {
      setWordSeasons(prev => prev.filter(s => s.id !== id));
      setWords(prev => prev.filter(w => w.season_id !== id));
    }
    return { error };
  };

  const updateWordSeason = async (id, title) => {
    const { data, error } = await supabase.from("word_seasons").update({ title }).eq("id", id).select();
    if (data) setWordSeasons(prev => prev.map(s => s.id === id ? data[0] : s));
    return { data, error };
  };

  const addWord = async (wordData) => {
    const payload = {
      season_id: wordData.seasonId ?? latestSeasonId(wordSeasons),
      word: wordData.word,
      phonetic: wordData.phonetic,
      definition: wordData.definition,
      example: wordData.example,
      translation: wordData.translation,
      created_by: user?.user_metadata?.full_name || user?.email,
    };
    const { data, error } = await supabase.from("words").insert([payload]).select();
    if (data) setWords(prev => [data[0], ...prev]);
    return { data, error };
  };

  const deleteWord = async (id) => {
    const { error } = await supabase.from("words").delete().eq("id", id);
    if (!error) setWords(prev => prev.filter(w => w.id !== id));
    return { error };
  };

  const updateWord = async (id, updatedData) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("words")
      .update({
        word: updatedData.word,
        phonetic: updatedData.phonetic,
        definition: updatedData.definition,
        example: updatedData.example,
        translation: updatedData.translation,
        // You might want to update updated_at if you have such a column
      })
      .eq("id", id)
      .select();

    if (data) {
      setWords(prev => prev.map(w => w.id === id ? data[0] : w));
    }
    return { data, error };
  };

  const addPublicHoliday = async (date, title) => {
    // One holiday per date: the calendar renders a single name per day and the working-day
    // maths keys off the date alone. public_holidays.date also has a UNIQUE index, but that
    // only surfaces as a raw Postgres error, so the readable message is produced here.
    const existing = findExistingPublicHoliday(publicHolidays, date);
    if (existing) {
      return {
        data: null,
        error: new Error(
          `${existing.title} is already the holiday on ${String(existing.date).split("T")[0]}. Delete it first to rename or replace it.`
        ),
      };
    }

    const { data, error } = await supabase.from("public_holidays").insert([{ date, title }]).select();
    if (data) setPublicHolidays(prev => [...prev, data[0]]);
    return { data, error };
  };

  const deletePublicHoliday = async (id) => {
    const { error } = await supabase.from("public_holidays").delete().eq("id", id);
    if (!error) setPublicHolidays(prev => prev.filter(h => h.id !== id));
    return { error };
  };

  const updateOfficeSettings = async (patch) => {
    const payload = { id: 1, ...officeSettings, ...patch, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("office_settings").upsert(payload).select().single();
    if (data) setOfficeSettings(data);
    return { data, error };
  };

  // ── Web punch in/out ────────────────────────────────────
  // Same attendance table as the mobile app's geofenced/biometric checkIn/checkOut, but
  // without the biometric check — gated by employees.can_punch_web (admin-editable from
  // the Attendance tab) instead, and skips the auto-fine mobile applies on a late
  // check-in. Employees with web_punch_office_bound set (on-site staff punching from the
  // website instead of the app) still go through the same browser-geolocation geofence
  // check mobile does; freelance/WFH employees skip it entirely.
  const verifyWebOfficeGeofence = () => {
    if (!officeSettings) throw new Error("Office location isn't configured yet. Contact an admin.");
    if (!navigator.geolocation) {
      throw new Error("Your browser doesn't support location — can't verify you're at the office.");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const distance = haversineMeters(
            position.coords.latitude,
            position.coords.longitude,
            officeSettings.latitude,
            officeSettings.longitude
          );
          if (distance > officeSettings.radius_meters) {
            reject(
              new Error(
                `You're ${Math.round(distance)}m from the office — you must be within ${officeSettings.radius_meters}m.`
              )
            );
            return;
          }
          resolve(position);
        },
        () => reject(new Error("Location permission is required to punch in/out from the office.")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const punchIn = async () => {
    if (!currentEmployee) throw new Error("No employee profile is linked to your account.");

    const todayStr = getNepalDateStr(new Date());
    const existing = attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr);
    if (existing?.check_in_at) throw new Error("You've already punched in today.");

    const position = currentEmployee.web_punch_office_bound ? await verifyWebOfficeGeofence() : null;

    const now = new Date();
    const { isLate, lateMinutes } = isWorkingDay(todayStr, publicHolidays)
      ? computeLateness(now, officeSettings?.sync_time)
      : { isLate: false, lateMinutes: 0 };

    const payload = {
      employee_name: currentEmployee.name,
      date: todayStr,
      check_in_at: now.toISOString(),
      check_in_lat: position?.coords.latitude ?? null,
      check_in_lng: position?.coords.longitude ?? null,
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
    return data;
  };

  const punchOut = async () => {
    if (!currentEmployee) throw new Error("No employee profile is linked to your account.");

    const todayStr = getNepalDateStr(new Date());
    const existing = attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr);
    if (!existing?.check_in_at) throw new Error("You need to punch in before punching out.");
    if (existing.check_out_at) throw new Error("You've already punched out today.");

    const position = currentEmployee.web_punch_office_bound ? await verifyWebOfficeGeofence() : null;

    const now = new Date();
    const { data, error } = await supabase
      .from("attendance")
      .update({
        check_out_at: now.toISOString(),
        check_out_lat: position?.coords.latitude ?? null,
        check_out_lng: position?.coords.longitude ?? null,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;

    setAttendance((prev) => prev.map((a) => (a.id === existing.id ? data : a)));
    return data;
  };

  // Admin correction of an existing attendance record — check_in_at/check_out_at are
  // already-resolved ISO strings (or null to clear), computed by the caller via
  // nepalLocalToUtcIso. Lateness is recomputed from the new check-in time, same rule as
  // punchIn, so an edited time keeps is_late/late_minutes consistent.
  const updateAttendanceRecord = async (id, { check_in_at, check_out_at }) => {
    const record = attendance.find((a) => a.id === id);
    if (!record) throw new Error("Attendance record not found.");

    const { isLate, lateMinutes } =
      check_in_at && isWorkingDay(record.date, publicHolidays)
        ? computeLateness(new Date(check_in_at), officeSettings?.sync_time)
        : { isLate: false, lateMinutes: 0 };

    const { data, error } = await supabase
      .from("attendance")
      .update({ check_in_at, check_out_at, is_late: isLate, late_minutes: lateMinutes })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    setAttendance((prev) => prev.map((a) => (a.id === id ? data : a)));
    return data;
  };

  const deleteAttendanceRecord = async (id) => {
    const { error } = await supabase.from("attendance").delete().eq("id", id);
    if (!error) setAttendance((prev) => prev.filter((a) => a.id !== id));
    return { error };
  };

  const addCompanyEvent = async (date, title) => {
    const { data, error } = await supabase.from("company_events").insert([{ date, title }]).select();
    if (data) {
      setCompanyEvents(prev => [...prev, data[0]]);
      fetch("/api/notify-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, excludeEmployeeName: currentEmployee?.name }),
      }).catch(err => console.error("notify-event error:", err));
    }
    return { data, error };
  };

  const deleteCompanyEvent = async (id) => {
    const { error } = await supabase.from("company_events").delete().eq("id", id);
    if (!error) setCompanyEvents(prev => prev.filter(e => e.id !== id));
    return { error };
  };

  const updateCompanyEvent = async (id, date, title) => {
    const { data, error } = await supabase.from("company_events").update({ date, title }).eq("id", id).select();
    if (data) setCompanyEvents(prev => prev.map(e => e.id === id ? data[0] : e));
    return { data, error };
  };

  const addMemory = async (memory) => {
    const payload = {
      type: memory.type,
      content: memory.content,
      caption: memory.caption || "",
      author_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Team Member",
      author_email: user?.email
    };
    const { data, error } = await supabase.from("memories").insert([payload]).select();
    if (error) throw error;
    if (data) setMemories(prev => [data[0], ...prev]);
    return { data, error };
  };

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const deleteMemory = async (id) => {
    const token = await getAuthToken();
    const res = await fetch(`/api/memories?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Delete failed");
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const updateMemory = async (id, updates) => {
    const token = await getAuthToken();
    const res = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Update failed");
    setMemories(prev => prev.map(m => m.id === id ? json.data : m));
    return { data: json.data };
  };
  const seedWordsTable = async () => {
    if (wordSeasons.length > 0) return;
    
    setIsSyncing(true);
    try {
      // 1. Insert Seasons
      const { data: createdSeasons, error: sError } = await supabase
        .from("word_seasons")
        .insert(wordSeedSeasons)
        .select();
      
      if (sError) throw sError;
      setWordSeasons(createdSeasons);

      // 2. Insert Words with correct season_id
      const wordsToInsert = wordSeedWords.map(w => ({
        season_id: createdSeasons[w.season_index].id,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        example: w.example,
        translation: w.translation,
        created_by: w.created_by
      }));

      const { data: createdWords, error: wError } = await supabase
        .from("words")
        .insert(wordsToInsert)
        .select();
      
      if (wError) throw wError;
      setWords(createdWords);
      
      await alertDialog("Word of the Day records seeded successfully! 🎉", { tone: "success" });
    } catch (err) {
      console.error("Seed error:", err);
      await alertDialog("Failed to seed data. Check console.", { tone: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const getEmployeeStats = useCallback(
    (name) => {
      const empFines = fines.filter((f) => f.employee_name === name);
      const total = empFines.reduce((s, f) => s + f.amount, 0);
      const paid = empFines
        .filter((f) => f.status === "paid")
        .reduce((s, f) => s + f.amount, 0);
      const unpaid = total - paid;
      return { total, paid, unpaid, records: empFines.length };
    },
    [fines]
  );

  const calculateCapacity = useCallback((employeeName, startDateStr, endDateStr) => {
    let totalHours = 0;
    let current = parseLocalDate(startDateStr);

    while (toDateStr(current) <= endDateStr) {
      const dateStr = toDateStr(current);
      const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Skip public holidays
      if (publicHolidays.some(h => h.date === dateStr)) continue;

      // Skip if on leave
      if (leaves.some(l => l.employee_name === employeeName && dateStr >= l.start_date && dateStr <= l.end_date)) continue;

      // Calculate net hours
      if (dayOfWeek === 5) {
        totalHours += 5; // Friday: 8 - 2 break - 1 extra = 5
      } else {
        totalHours += 6; // Mon-Thu: 8 - 2 break = 6
      }
      current.setDate(current.getDate() + 1);
    }
    return totalHours;
  }, [publicHolidays, leaves]);

  const calculateSprintRange = (startDateStr) => {
    let date = parseLocalDate(startDateStr);
    let workingDays = 1; 
    while (workingDays < 10) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays++;
      }
    }
    return {
      start: startDateStr,
      end: toDateStr(date)
    };
  };

  const addSprint = async (startDate, title) => {
    const { start, end } = calculateSprintRange(startDate);
    await supabase.from("sprints").update({ is_active: false }).neq("id", 0);
    const { data, error } = await supabase.from("sprints").insert([{ 
      start_date: start, 
      end_date: end, 
      title,
      is_active: true
    }]).select();
    if (data) {
      setSprints(prev => [data[0], ...prev.map(s => ({ ...s, is_active: false }))]);
      setActiveSprint(data[0]);
    }
    return { data, error };
  };

  const resetData = async () => {
    if (await confirmDialog("This will CLEAR CLOUD DATA and reset to seeds. Proceed?", { danger: true, confirmText: "Clear Data" })) {
        // Warning: This is a heavy operation
        await Promise.all([
            supabase.from("fines").delete().neq("id", 0),
            supabase.from("leaves").delete().neq("id", 0),
            supabase.from("standup_records").delete().neq("id", 0),
            supabase.from("employees").delete().neq("id", 0),
        ]);
        fetchData();
    }
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
        isSyncing,
        addEmployee,
        updateEmployee,
        removeEmployee,
        setEmployeePunchAccess,
        setEmployeeOfficeBoundPunch,
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
        submitStandupResponse,
        updateStandupResponse,
        addWithdrawal,
        deleteWithdrawal,
        addWordSeason,
        deleteWordSeason,
        updateWordSeason,
        addWord,
        deleteWord,
        updateWord,
        seedWordsTable,
        addPublicHoliday,
        deletePublicHoliday,
        addCompanyEvent,
        deleteCompanyEvent,
        updateCompanyEvent,
        sprints,
        activeSprint,
        addSprint,
        calculateCapacity,
        syncLocalToCloud,
        resetData,
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
        updateOfficeSettings,
        canPunchAttendance,
        punchIn,
        punchOut,
        updateAttendanceRecord,
        deleteAttendanceRecord,
        leaveTypes,
        addLeaveType,
        updateLeaveType,
        deleteLeaveType,
        projects,
        projectLinks,
        projectEnvironments,
        projectMembers,
        addProject,
        updateProject,
        deleteProject,
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
