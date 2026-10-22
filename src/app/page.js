"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Dashboard from "@/components/Dashboard";
import EmployeeList from "@/components/EmployeeList";
import FineTable from "@/components/FineTable";
import LeavePage from "@/components/LeavePage";
import AddEmployeeModal from "@/components/AddEmployeeModal";
import AddFineModal from "@/components/AddFineModal";
import AddLeaveModal from "@/components/AddLeaveModal";
import AddStandupFineModal from "@/components/AddStandupFineModal";
import EditEmployeeModal from "@/components/EditEmployeeModal";
import StandupFineTable from "@/components/StandupFineTable";
import WithdrawModal from "@/components/WithdrawModal";
import WordPage from "@/components/WordPage";
import AddWordSeasonModal from "@/components/AddWordSeasonModal";
import AddWordModal from "@/components/AddWordModal";
import EditWordSeasonModal from "@/components/EditWordSeasonModal";
import AddFineSeasonModal from "@/components/AddFineSeasonModal";
import EditFineSeasonModal from "@/components/EditFineSeasonModal";
import AddLeaveSeasonModal from "@/components/AddLeaveSeasonModal";
import EditLeaveSeasonModal from "@/components/EditLeaveSeasonModal";
import CapacityPage from "@/components/CapacityPage";
import AddPublicHolidayModal from "@/components/AddPublicHolidayModal";
import EditWordModal from "@/components/EditWordModal";
import { useSplashExit } from "@/components/HumanLoader";
import EventsPage from "@/components/EventsPage";
import AddCompanyEventModal from "@/components/AddCompanyEventModal";
import EditCompanyEventModal from "@/components/EditCompanyEventModal";
import PlanningPokerPage from "@/components/PlanningPokerPage";
import RetrospectivePage from "@/components/RetrospectivePage";
import MemoriesPage from "@/components/MemoriesPage";
import AddMemoryModal from "@/components/AddMemoryModal";
import AttendancePage from "@/components/AttendancePage";
import ReleaseUpdatesModal from "@/components/ReleaseUpdatesModal";
import SettingsPage from "@/components/SettingsPage";
import ProjectsPage from "@/components/ProjectsPage";
import TasksPage from "@/components/TasksPage";
import CalendarPage from "@/components/CalendarPage";
import StandupFormPage from "@/components/StandupFormPage";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import PageHead from "@/components/PageHead";
import Icon from "@/components/Icon";
import { navGroupsFor, normalizeTab, allowedTab } from "@/lib/navigation";
import { pageMetaFor } from "@/lib/pageMeta";
import { formatBs } from "@/lib/nepaliDate";
import { getNepalParts } from "@/lib/standupWindow";

export default function Home() {
  const { isLoaded, resetData, isSyncing, syncLocalToCloud, user, signOut, currentEmployee, isAuthReady, isAdmin, canManageFines, animationsEnabled, employees } = useApp();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const isAuthorized = user && currentEmployee && currentEmployee.status === "active";

  // Auth guard — redirect to /login if not signed in
  useEffect(() => {
    if (isLoaded && isAuthReady && !user) {
      router.replace("/login");
    }
  }, [isLoaded, isAuthReady, user, router]);

  const [showReleaseUpdates, setShowReleaseUpdates] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddFine, setShowAddFine] = useState(false);
  // Who Record Fine opens for, when it's opened from someone's details on Employees.
  const [fineFor, setFineFor] = useState(null);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // { id, at }: a person opened from the top bar's search. `at` keys EmployeeList, so
  // each request mounts it afresh with that person's details open.
  const [employeeRequest, setEmployeeRequest] = useState(null);
  // { seasonId, at }: Late Fines opened from a bell row on that fine's season, keyed the same way.
  const [fineRequest, setFineRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showEditWord, setShowEditWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [showEditSeason, setShowEditSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showAddFineSeason, setShowAddFineSeason] = useState(false);
  const [showEditFineSeason, setShowEditFineSeason] = useState(false);
  const [editingFineSeason, setEditingFineSeason] = useState(null);
  const [showAddLeaveSeason, setShowAddLeaveSeason] = useState(false);
  const [showEditLeaveSeason, setShowEditLeaveSeason] = useState(false);
  const [editingLeaveSeason, setEditingLeaveSeason] = useState(null);

  // Load active tab from localStorage on mount
  useEffect(() => {
    // A shared issue link (#issue=HTT-12) opens the Tasks tab whatever was open last.
    if (/^#issue=/.test(window.location.hash)) {
      setActiveTab("tasks");
      return;
    }
    setActiveTab(normalizeTab(localStorage.getItem("heubert-active-tab")));
  }, []);

  // Admin-only tabs (Projects, Settings) fall back to the dashboard once we know the role.
  // Adjusted during render rather than in an effect, so the wrong tab never paints.
  if (currentEmployee && allowedTab(activeTab, { isAdmin }) !== activeTab) {
    setActiveTab(allowedTab(activeTab, { isAdmin }));
  }

  // A person opened from the search, or a season from the bell, holds for that visit only:
  // once the tab is left, coming back shows the plain list.
  if (employeeRequest && activeTab !== "employees") {
    setEmployeeRequest(null);
  }
  if (fineRequest && activeTab !== "records") setFineRequest(null);

  // An issue link opened while the app is already up (another tab's link, pasted URL).
  useEffect(() => {
    const onHash = () => {
      if (/^#issue=/.test(window.location.hash)) setActiveTab("tasks");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("heubert-active-tab", activeTab);
    }
  }, [activeTab]);

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setShowEditEmployee(true);
  };

  const handleEditWord = (word) => {
    setEditingWord(word);
    setShowEditWord(true);
  };

  const handleEditSeason = (season) => {
    setEditingSeason(season);
    setShowEditSeason(true);
  };

  const handleEditFineSeason = (season) => {
    setEditingFineSeason(season);
    setShowEditFineSeason(true);
  };

  const handleEditLeaveSeason = (season) => {
    setEditingLeaveSeason(season);
    setShowEditLeaveSeason(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEditEvent(true);
  };

  const booting = !isLoaded || !isAuthReady || (user && !isAuthorized);
  // Stays mounted for one fade after booting finishes, over the app below it.
  const splash = useSplashExit(booting);

  if (booting) {
    return <>{splash}</>;
  }

  //   if (true) {
  //   return <HumanLoader />;
  // }

  if (activeTab === "memories") {
    return (
      <>
      {splash}
      <div className="standalone-memories-root">
        <MemoriesPage 
          onAddMemory={() => setShowAddMemory(true)} 
          onBack={() => setActiveTab("dashboard")}
        />
        <AddMemoryModal 
          isOpen={showAddMemory}
          onClose={() => setShowAddMemory(false)}
        />
      </div>
      </>
    );
  }

  // Same as the old tab row: Late Fines also clears the employee filter.
  const selectTab = (id) => {
    setActiveTab(id);
    if (id === "records") setSelectedEmployee(null);
    setNavOpen(false);
  };

  // The top bar's search and bell. The fine lists take the person after the tab change,
  // not through selectTab, which clears the Late Fines filter.
  const handleNavigate = (target) => {
    if (target.tab === "employees") {
      setActiveTab("employees");
      setEmployeeRequest({ id: target.employeeId, at: Date.now() });
    } else if (target.tab === "records" || target.tab === "standup") {
      setActiveTab(target.tab);
      setSelectedEmployee(target.employeeName);
      setFineRequest(target.tab === "records" && "seasonId" in target ? { seasonId: target.seasonId, at: Date.now() } : null);
    } else {
      return;
    }
    setNavOpen(false);
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const groupLabel = navGroupsFor({ isAdmin }).find((g) => g.items.some((i) => i.id === activeTab))?.label;
  const pageHead = pageMetaFor(activeTab, { firstName, hour: new Date().getHours(), groupLabel });
  if (activeTab === "employees") {
    const members = employees.length;
    pageHead.eyebrow = [groupLabel, `${members} ${members === 1 ? "member" : "members"}`].filter(Boolean).join(" · ");
  }
  if (activeTab === "dashboard") {
    // "Monday · Oct 19 · 3 Kartik 2083", all from today's date in Nepal.
    const todayStr = getNepalParts(new Date()).dateStr;
    const today = new Date(`${todayStr}T00:00:00Z`);
    const weekday = today.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    const monthDay = today.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    pageHead.eyebrow = [weekday, monthDay, formatBs(todayStr)].filter(Boolean).join(" · ");
  }

  const plus = <Icon name="plus" size={16} strokeWidth={2.2} />;
  let pageActions = null;
  if (activeTab === "employees" && isAdmin) {
    pageActions = (
      <button className="btn btn-primary" onClick={() => setShowAddEmployee(true)}>
        {plus} Add Employee
      </button>
    );
  } else if (activeTab === "leaves") {
    pageActions = (
      <button className="btn btn-primary" onClick={() => setShowAddLeave(true)}>
        {plus} Record Leave
      </button>
    );
  } else if (activeTab === "standup" && canManageFines) {
    pageActions = (
      <button className="btn btn-danger" onClick={() => setShowAddStandup(true)}>
        {plus} Standup Fine
      </button>
    );
  } else if (activeTab === "records" && canManageFines) {
    pageActions = (
      <button className="btn btn-primary" onClick={() => setShowAddFine(true)}>
        {plus} Record Fine
      </button>
    );
  } else if (activeTab === "dashboard" && (isAdmin || canManageFines)) {
    pageActions = (
      <>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setShowAddEmployee(true)}>
            Add Employee
          </button>
        )}
        {canManageFines && (
          <button className="btn btn-primary" onClick={() => setShowAddFine(true)}>
            {plus} Record Fine
          </button>
        )}
      </>
    );
  }

  return (
    <>
    {splash}
    {/* motion-off stops the CSS-only motion (card lift, banner scenes) with Animations off. */}
    <div className={`app-shell${animationsEnabled === false ? " motion-off" : ""}`}>
      <Sidebar
        activeTab={activeTab}
        onSelect={selectTab}
        isAdmin={isAdmin}
        onShowUpdates={() => setShowReleaseUpdates(true)}
        onSignOut={signOut}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />
      <div className="app-main">
      <TopBar onOpenMenu={() => setNavOpen(true)} onNavigate={handleNavigate} />

      {/* Content */}
      <main className="app-content">
        {/* The standup page draws its own heading: its day switch and clock sit in it. */}
        {activeTab !== "standup-form" && <PageHead {...pageHead}>{pageActions}</PageHead>}
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "employees" && (
          <EmployeeList
            key={employeeRequest?.at ?? "list"}
            openEmployeeId={employeeRequest?.id}
            onEditEmployee={handleEditEmployee}
            onRecordFine={
              canManageFines
                ? (name) => {
                    setFineFor(name);
                    setShowAddFine(true);
                  }
                : null
            }
            onSelectEmployee={(emp) => {
              setSelectedEmployee(emp);
              if (emp) setActiveTab("records");
            }}
            selectedEmployee={selectedEmployee}
            onAddEmployee={() => setShowAddEmployee(true)}
          />
        )}
        {activeTab === "records" && (
          <FineTable
            key={fineRequest?.at ?? "fines"}
            initialSeasonId={fineRequest?.seasonId}
            selectedEmployee={selectedEmployee}
            onAddFine={() => setShowAddFine(true)}
            onWithdraw={() => setShowWithdraw(true)}
            onAddSeason={() => setShowAddFineSeason(true)}
            onEditSeason={handleEditFineSeason}
          />
        )}
        {activeTab === "standup" && (
          <StandupFineTable 
            selectedEmployee={selectedEmployee} 
            onAddStandup={() => setShowAddStandup(true)}
          />
        )}
        {activeTab === "standup-form" && <StandupFormPage head={pageHead} />}
        {activeTab === "leaves" && (
          <LeavePage
            onAddLeave={() => setShowAddLeave(true)}
            onAddHoliday={() => setShowAddHoliday(true)}
            onAddSeason={() => setShowAddLeaveSeason(true)}
            onEditSeason={handleEditLeaveSeason}
          />
        )}
        {activeTab === "attendance" && <AttendancePage />}
        {activeTab === "capacity" && <CapacityPage />}
        {activeTab === "words" && (
          <WordPage 
            onAddSeason={() => setShowAddSeason(true)} 
            onEditSeason={handleEditSeason}
            onAddWord={() => setShowAddWord(true)} 
            onEditWord={handleEditWord}
          />
        )}
        {activeTab === "events" && (
          <EventsPage 
            onAddEvent={() => setShowAddEvent(true)}
            onEditEvent={handleEditEvent}
          />
        )}
        {activeTab === "projects" && <ProjectsPage />}
        {activeTab === "tasks" && <TasksPage />}
        {activeTab === "calendar" && <CalendarPage />}
        {activeTab === "poker" && <PlanningPokerPage />}
        {activeTab === "retro" && <RetrospectivePage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
      </div>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
      />
      <AddFineModal
        key={fineFor ?? "fine"}
        isOpen={showAddFine}
        defaultName={fineFor ?? ""}
        onClose={() => {
          setShowAddFine(false);
          setFineFor(null);
        }}
      />
      <AddFineSeasonModal
        isOpen={showAddFineSeason}
        onClose={() => setShowAddFineSeason(false)}
      />
      <EditFineSeasonModal
        isOpen={showEditFineSeason}
        onClose={() => {
          setShowEditFineSeason(false);
          setEditingFineSeason(null);
        }}
        season={editingFineSeason}
      />
      <AddLeaveModal
        isOpen={showAddLeave}
        onClose={() => setShowAddLeave(false)}
      />
      <AddLeaveSeasonModal
        isOpen={showAddLeaveSeason}
        onClose={() => setShowAddLeaveSeason(false)}
      />
      <EditLeaveSeasonModal
        isOpen={showEditLeaveSeason}
        onClose={() => {
          setShowEditLeaveSeason(false);
          setEditingLeaveSeason(null);
        }}
        season={editingLeaveSeason}
      />
      <AddStandupFineModal
        isOpen={showAddStandup}
        onClose={() => setShowAddStandup(false)}
      />
      <EditEmployeeModal
        isOpen={showEditEmployee}
        onClose={() => {
          setShowEditEmployee(false);
          setEditingEmployee(null);
        }}
        employee={editingEmployee}
      />
      <WithdrawModal
        isOpen={showWithdraw}
        onClose={() => setShowWithdraw(false)}
      />
      <AddWordSeasonModal
        isOpen={showAddSeason}
        onClose={() => setShowAddSeason(false)}
      />
      <AddWordModal
        isOpen={showAddWord}
        onClose={() => setShowAddWord(false)}
      />
      <AddPublicHolidayModal
        isOpen={showAddHoliday}
        onClose={() => setShowAddHoliday(false)}
      />
      <AddCompanyEventModal
        isOpen={showAddEvent}
        onClose={() => setShowAddEvent(false)}
      />
      <EditCompanyEventModal
        isOpen={showEditEvent}
        onClose={() => {
          setShowEditEvent(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
      />
      <EditWordSeasonModal
        isOpen={showEditSeason}
        onClose={() => {
          setShowEditSeason(false);
          setEditingSeason(null);
        }}
        season={editingSeason}
      />
      <AddMemoryModal 
        isOpen={showAddMemory}
        onClose={() => setShowAddMemory(false)}
      />
      <EditWordModal
        isOpen={showEditWord}
        onClose={() => {
          setShowEditWord(false);
          setEditingWord(null);
        }}
        word={editingWord}
      />
      <ReleaseUpdatesModal
        isOpen={showReleaseUpdates}
        onClose={() => setShowReleaseUpdates(false)}
      />
    </div>
    </>
  );
}
