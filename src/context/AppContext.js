"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, supabaseStandup } from "@/lib/supabase";
import { wordSeedSeasons, wordSeedWords } from "@/data/wordSeedData";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [fines, setFines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [standupFines, setStandupFines] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wordSeasons, setWordSeasons] = useState([]);
  const [words, setWords] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [standupSubmissions, setStandupSubmissions] = useState([]);
  const [standupQuestions, setStandupQuestions] = useState([]);

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

  // Initial load from Supabase
  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("fines").select("*").order("date", { ascending: false }),
        supabase.from("leaves").select("*").order("start_date", { ascending: false }),
        supabase.from("standup_records").select("*").order("date", { ascending: false }),
        supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
        supabase.from("word_seasons").select("*").order("created_at", { ascending: true }),
        supabase.from("words").select("*").order("created_at", { ascending: false }),
        supabase.from("public_holidays").select("*").order("date", { ascending: true }),
        supabase.from("sprints").select("*").order("created_at", { ascending: false }),
        supabaseStandup.from("standup_responses").select("*").order("date", { ascending: false }),
        supabaseStandup.from("questions").select("*").order("sort_order", { ascending: true }),
      ]);

      const [
        { data: empData },
        { data: fineData },
        { data: leaveData },
        { data: standupData },
        { data: withdrawalData },
        { data: seasonData },
        { data: wordData },
        { data: holidayData },
        { data: sprintsData },
        { data: standupSubData },
        { data: standupQuestData },
      ] = results;

      if (empData) setEmployees(empData);
      if (fineData) setFines(fineData);
      if (leaveData) setLeaves(leaveData);
      if (standupData) setStandupFines(standupData);
      if (withdrawalData) setWithdrawals(withdrawalData);
      if (seasonData) setWordSeasons(seasonData);
      if (wordData) setWords(wordData);
      if (holidayData) setPublicHolidays(holidayData);
      if (sprintsData) {
        setSprints(sprintsData);
        const active = sprintsData.find(s => s.is_active);
        if (active) setActiveSprint(active);
      }
      if (standupSubData) setStandupSubmissions(standupSubData);
      if (standupQuestData) setStandupQuestions(standupQuestData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAndCreateEmployee(session.user);
      }
      setIsAuthReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (event === "SIGNED_IN" && currentUser) {
        checkAndCreateEmployee(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  const checkAndCreateEmployee = async (u) => {
    if (!u.email) return;

    try {
      // 1. Check if employee already exists by email (case-insensitive)
      const { data: existing, error } = await supabase
        .from("employees")
        .select("*")
        .or(`work_email.ilike.${u.email},personal_email.ilike.${u.email}`);

      if (error) {
        console.error("Error checking employee by email:", error);
        return;
      }

      // If already exists, ignore
      if (existing && existing.length > 0) {
        console.log("Employee already exists for email:", u.email);
        return;
      }

      // 2. If not found, prepare to create
      console.log("Auto-creating employee record for:", u.email);
      const fullName = u.user_metadata?.full_name;
      const emailPrefix = u.email.split("@")[0];
      
      // Handle potential name UNIQUE constraint conflict
      let nameToUse = fullName || emailPrefix;
      
      // Keep checking until we find a unique name
      let isUnique = false;
      let attempt = 0;
      let finalName = nameToUse;

      while (!isUnique && attempt < 5) {
        const { data: nameCheck, error: checkError } = await supabase
          .from("employees")
          .select("name")
          .ilike("name", finalName);

        if (checkError) {
          console.error("Error checking name uniqueness:", checkError);
          break; 
        }

        if (nameCheck && nameCheck.length > 0) {
          // Name is taken, modify and try again
          attempt++;
          if (attempt === 1) {
            finalName = `${nameToUse} (${u.email})`;
          } else {
            finalName = `${nameToUse} (${u.email}) ${attempt}`;
          }
        } else {
          isUnique = true;
        }
      }

      const { error: insertError } = await addEmployee({
        name: finalName,
        workEmail: u.email,
        status: "active",
        empNo: `G-${Math.floor(1000 + Math.random() * 9000)}`
      });

      if (!insertError) {
        console.log("Employee record created successfully:", finalName);
        // Refresh data to show the new employee immediately
        fetchData();
      } else {
        console.error("Error inserting new employee:", insertError);
      }
    } catch (err) {
      console.error("Error in auto-employee creation:", err);
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

      alert("Sync complete! Please refresh the page.");
      fetchData();
    } catch (err) {
      console.error("Sync error:", err);
      alert("Error during sync. See console.");
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
    const payload = {
        employee_name: fine.name,
        date: fine.date,
        amount: fine.amount,
        status: fine.status
    };
    const { data, error } = await supabase.from("fines").insert([payload]).select();
    if (data) setFines(prev => [data[0], ...prev]);
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

  const addLeave = async (leave) => {
    const payload = {
        employee_name: leave.name,
        start_date: leave.startDate,
        end_date: leave.endDate,
        type: leave.type,
        reason: leave.reason
    };
    const { data } = await supabase.from("leaves").insert([payload]).select();
    if (data) setLeaves(prev => [data[0], ...prev]);
  };

  const deleteLeave = async (id) => {
    const { error } = await supabase.from("leaves").delete().eq("id", id);
    if (!error) setLeaves(prev => prev.filter(l => l.id !== id));
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
        status: updatedData.status
      })
      .eq("id", id)
      .select();

    if (data) {
      setStandupFines(prev => prev.map(s => s.id === id ? data[0] : s));
    }
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
    const { data, error } = await supabase.from("public_holidays").insert([{ date, title }]).select();
    if (data) setPublicHolidays(prev => [...prev, data[0]]);
    return { data, error };
  };

  const deletePublicHoliday = async (id) => {
    const { error } = await supabase.from("public_holidays").delete().eq("id", id);
    if (!error) setPublicHolidays(prev => prev.filter(h => h.id !== id));
    return { error };
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
      
      alert("Word of the Day records seeded successfully! 🎉");
    } catch (err) {
      console.error("Seed error:", err);
      alert("Failed to seed data. Check console.");
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
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let totalHours = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

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
    }
    return totalHours;
  }, [publicHolidays, leaves]);

  const calculateSprintRange = (startDateStr) => {
    let date = new Date(startDateStr);
    let workingDays = 1; 
    while (workingDays < 10) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays++;
      }
    }
    return {
      start: startDateStr,
      end: date.toISOString().split('T')[0]
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
    if (confirm("This will CLEAR CLOUD DATA and reset to seeds. Proceed?")) {
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
        isLoaded,
        isSyncing,
        addEmployee,
        updateEmployee,
        removeEmployee,
        addFine,
        toggleFineStatus,
        deleteFine,
        updateFine,
        getEmployeeStats,
        addLeave,
        deleteLeave,
        addStandupFine,
        toggleStandupFineStatus,
        deleteStandupFine,
        updateStandupFine,
        addWithdrawal,
        deleteWithdrawal,
        addWordSeason,
        deleteWordSeason,
        addWord,
        deleteWord,
        updateWord,
        seedWordsTable,
        addPublicHoliday,
        deletePublicHoliday,
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
