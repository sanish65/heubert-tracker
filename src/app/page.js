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
import Link from "next/link";
import CapacityPage from "@/components/CapacityPage";
import AddPublicHolidayModal from "@/components/AddPublicHolidayModal";
import EditWordModal from "@/components/EditWordModal";

export default function Home() {
  const { isLoaded, resetData, isSyncing, syncLocalToCloud, user, signOut } = useApp();
  const router = useRouter();

  // Auth guard — redirect to /login if not signed in
  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/login");
    }
  }, [isLoaded, user, router]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showEditWord, setShowEditWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);

  // Load active tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem("heubert-active-tab");
    if (savedTab && ["dashboard", "employees", "records", "standup", "leaves", "words", "capacity"].includes(savedTab)) {
      setActiveTab(savedTab);
    }
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

  if (!isLoaded) {
    return (
      <div className="loading-splash">
        <div className="splash-logo">⏰</div>
        <div className="splash-text">Heubert Tracker</div>
        <div className="loader-bar-container">
          <div className="loader-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="title-row">
            <h1 className="app-title">
              <span className="title-icon">⏰</span>
              HTT
            </h1>
            {user && (
              <div className="user-profile">
                <div className="avatar-wrapper">
                  <img 
                    src={user.user_metadata?.avatar_url || "https://www.gravatar.com/avatar/?d=mp"} 
                    alt={user.email} 
                    className="user-avatar"
                  />
                  <div className="avatar-ring"></div>
                </div>
                <div className="user-details">
                  <span className="user-name-label">Hi, {user.user_metadata?.full_name?.split(' ')[0] || user.email.split('@')[0]}</span>
                </div>
              </div>
            )}
          </div>
          <p className="app-subtitle">Internal Team Accountability & Record System</p>
        </div>
        <div className="header-right-group">
          <Link href="/meeting" className="btn-start-meeting">
            🚀 Start Meeting
          </Link>
          <div className="header-actions">
          {activeTab === "employees" && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowAddEmployee(true)}
            >
              <span>+</span> Add Employee
            </button>
          )}
          {activeTab === "leaves" && (
            <button
              className="btn btn-accent"
              onClick={() => setShowAddLeave(true)}
            >
              <span>+</span> Record Leave
            </button>
          )}
          {activeTab === "standup" && (
            <button
              className="btn btn-secondary"
              style={{ border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}
              onClick={() => setShowAddStandup(true)}
            >
              <span>+</span> Standup Fine
            </button>
          )}
          {activeTab === "records" && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddFine(true)}
            >
              <span>+</span> Record Fine
            </button>
          )}
          {activeTab === "dashboard" && (
            <div className="dashboard-quick-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddEmployee(true)}
              >
                Add Employee
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddFine(true)}
              >
                Record Fine
              </button>
            </div>
          )}
          <button className="btn-logout-premium" onClick={signOut}>
            <span className="logout-icon">󰗼</span>
            Logout
          </button>
        </div>
      </div>
    </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === "dashboard" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-tab ${activeTab === "records" ? "nav-tab-active" : ""}`}
          onClick={() => {
            setActiveTab("records");
            setSelectedEmployee(null);
          }}
        >
          📋 Late Fines
        </button>
        <button
          className={`nav-tab ${activeTab === "standup" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("standup")}
        >
          📝 Standup Fines
        </button>
        <button
          className={`nav-tab ${activeTab === "leaves" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("leaves")}
        >
          🏖️ Leaves
        </button>
        <button
          className={`nav-tab ${activeTab === "capacity" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("capacity")}
        >
          🏗️ Capacity
        </button>
        <button
          className={`nav-tab ${activeTab === "words" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("words")}
        >
          📖 Words
        </button>
        <button
          className={`nav-tab nav-tab-right ${activeTab === "employees" ? "nav-tab-active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          👥 Employees
        </button>
      </nav>

      {/* Content */}
      <main className="app-content">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "employees" && (
          <EmployeeList
            onEditEmployee={handleEditEmployee}
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
            selectedEmployee={selectedEmployee} 
            onAddFine={() => setShowAddFine(true)}
            onWithdraw={() => setShowWithdraw(true)}
          />
        )}
        {activeTab === "standup" && (
          <StandupFineTable 
            selectedEmployee={selectedEmployee} 
            onAddStandup={() => setShowAddStandup(true)}
          />
        )}
        {activeTab === "leaves" && (
          <LeavePage 
            onAddLeave={() => setShowAddLeave(true)} 
            onAddHoliday={() => setShowAddHoliday(true)}
          />
        )}
        {activeTab === "capacity" && <CapacityPage />}
        {activeTab === "words" && (
          <WordPage 
            onAddSeason={() => setShowAddSeason(true)} 
            onAddWord={(sid) => {
              setSelectedSeasonId(sid);
              setShowAddWord(true);
            }} 
            onEditWord={handleEditWord}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <span>Heubert Tracker © 2026</span>
          <span className="db-status">
            <span className="pulse-dot"></span> Cloud Database Connected
          </span>
        </div>
        <div className="footer-actions">
          {/* <button 
            className={`btn btn-sm ${isSyncing ? 'btn-loading' : 'btn-secondary'}`} 
            onClick={syncLocalToCloud}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : '🔄 Sync Local Data'}
          </button> */}
          {/* <button className="btn btn-ghost btn-sm" onClick={resetData}>
            Reset to Default Data
          </button> */}
        </div>
      </footer>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
      />
      <AddFineModal
        isOpen={showAddFine}
        onClose={() => setShowAddFine(false)}
      />
      <AddLeaveModal
        isOpen={showAddLeave}
        onClose={() => setShowAddLeave(false)}
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
        seasonId={selectedSeasonId}
      />
      <AddPublicHolidayModal
        isOpen={showAddHoliday}
        onClose={() => setShowAddHoliday(false)}
      />
      <EditWordModal
        isOpen={showEditWord}
        onClose={() => {
          setShowEditWord(false);
          setEditingWord(null);
        }}
        word={editingWord}
      />
    </div>
  );
}
