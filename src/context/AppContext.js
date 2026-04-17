"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [fines, setFines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [standupFines, setStandupFines] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  const adminEmails = [
    "sanish@heubert.com",
    "nikhil@heubert.com",
    "pranay@heubert.com",
    "pratisha@heubert.com"
  ];

  const fineAdminEmails = [
    "sanish@heubert.com"
  ];

  const isAdmin = user ? adminEmails.includes(user.email.toLowerCase()) : false;
  const isFineAdmin = user ? fineAdminEmails.includes(user.email.toLowerCase()) : false;

  // Initial load from Supabase
  const fetchData = useCallback(async () => {
    try {
      const [
        { data: empData },
        { data: fineData },
        { data: leaveData },
        { data: standupData },
      ] = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("fines").select("*").order("date", { ascending: false }),
        supabase.from("leaves").select("*").order("start_date", { ascending: false }),
        supabase.from("standup_records").select("*").order("date", { ascending: false }),
      ]);

      if (empData) setEmployees(empData);
      if (fineData) setFines(fineData);
      if (leaveData) setLeaves(leaveData);
      if (standupData) setStandupFines(standupData);
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
        .or(`work_email.ilike."${u.email}",personal_email.ilike."${u.email}"`);

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
        isLoaded,
        isSyncing,
        addEmployee,
        updateEmployee,
        removeEmployee,
        addFine,
        toggleFineStatus,
        deleteFine,
        getEmployeeStats,
        addLeave,
        deleteLeave,
        addStandupFine,
        toggleStandupFineStatus,
        deleteStandupFine,
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
