"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import EditFineModal from "@/components/EditFineModal";
import EditStandupModal from "@/components/EditStandupModal";
import EditWordModal from "@/components/EditWordModal";
import EditLeaveModal from "@/components/EditLeaveModal";
import { useSplashExit } from "@/components/HumanLoader";
import EventBanner from "@/components/EventBanner";
import ArcheryBanner from "@/components/ArcheryBanner";
import MeetingShoutouts, { MeetingAvatar } from "@/components/MeetingShoutouts";
import NewFiscalYearBanner from "@/components/NewFiscalYearBanner";
import DashainBanner from "@/components/DashainBanner";
import StatsCard from "@/components/StatsCard";
import Icon from "@/components/Icon";
import { computeLeaveBalances, parseHalfDaySegment, findExistingLateFine } from "@/lib/utils";
import { formatBs } from "@/lib/nepaliDate";
import { useDialog } from "@/context/DialogContext";

const MEETING_TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const MEETING_SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
// The On leave figure's breakdown, e.g. "1 full day · 1 half day".
const LEAVE_COUNT_LABELS = { full: "full day", half: "half day", early: "early leave" };
const MEETING_LINK = "https://meet.google.com/khg-nxbc-ayo";
// Summary figure dots (Meeting.dc.html): submitted green, missing red, leave cyan, late amber.
const FIGURE_COLORS = { submitted: "#22C55E", missing: "#F43F5E", leave: "#2DD4EF", late: "#F5A524" };

// Jira tickets in these states are left out of the meeting; the rest are read blockers first.
const HIDDEN_TICKET_STATUSES = ["on hold", "rejected", "backlog"];
const TICKET_STATUS_ORDER = {
  "blocked":     0,
  "in progress": 1,
  "in review":   2,
  "to do":       3,
  "on hold":     4,
  "done":        5,
  "closed":      6,
};

// What the idle bug says while it walks across a submission in the enlarged view.
const NUDGE_PHRASES = [
  "There is so much work left today",
  "Gotta finish these tasks ASAP today",
  "Time to lock in and code!",
  "Let's crush these tickets!",
  "Focus mode activated",
  "Still got a lot on my plate!",
];

// "09:42:17", the viewer's local time.
const CLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// "06:12": minutes and seconds, for the meeting timers.
function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// "Monday, Oct 19 2026" for a local "YYYY-MM-DD".
function meetingDayLabel(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay} ${d.getFullYear()}`;
}

// A submission (real or synthetic "missing") is matched to an employee the same way the
// missing-submission list matches employees: by email first, then by first name.
function submissionMatchesEmployee(submission, emp) {
  const subEmail = submission.email?.trim().toLowerCase();
  const workEmail = emp.work_email?.trim().toLowerCase();
  const personalEmail = emp.personal_email?.trim().toLowerCase();
  if (subEmail && (subEmail === workEmail || subEmail === personalEmail)) return true;

  const subFirstName = submission.name?.trim().split(/\s+/)[0].toLowerCase();
  const empFirstName = emp.name?.trim().split(/\s+/)[0].toLowerCase();
  return !!subFirstName && subFirstName === empFirstName;
}

// A ticket's url comes from the standup form's data: only a web link becomes an anchor.
function safeTicketUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

export default function MeetingPage() {
  const {
    fines: allFines,
    fineSeasons,
    standupFines: allStandupFines,
    leaves,
    leaveSeasons,
    words,
    wordSeasons,
    addFine, 
    addStandupFine,
    addWord, 
    addLeave,
    deleteFine,
    deleteStandupFine,
    deleteWord,
    deleteLeave,
    updateFine,
    updateStandupFine,
    updateWord,
    updateLeave,
    employees,
    isAdmin,
    canManageFines,
    canManageLeave,
    isLoaded,
    publicHolidays,
    leaveTypes,
    companyEvents,
    standupSubmissions,
    standupQuestions,
    user,
    currentEmployee,
    isAuthReady,
    animationsEnabled,
    projects,
    projectMembers,
  } = useApp();
  const { confirmDialog } = useDialog();
  const lateFineExcludedNames = useMemo(
    () => new Set(employees.filter((e) => e.late_fine_excluded).map((e) => e.name)),
    [employees]
  );
  const standupFineExcludedNames = useMemo(
    () => new Set(employees.filter((e) => e.standup_fine_excluded).map((e) => e.name)),
    [employees]
  );
  const fines = useMemo(() => allFines.filter(f => !lateFineExcludedNames.has(f.employee_name)), [allFines, lateFineExcludedNames]);
  const standupFines = useMemo(() => allStandupFines.filter(f => !standupFineExcludedNames.has(f.employee_name)), [allStandupFines, standupFineExcludedNames]);
  const lateFineSelectableEmployees = useMemo(() => employees.filter(e => e.status !== "resigned" && !e.late_fine_excluded), [employees]);
  const standupFineSelectableEmployees = useMemo(() => employees.filter(e => e.status !== "resigned" && !e.standup_fine_excluded), [employees]);
  const leaveSelectableEmployees = useMemo(() => employees.filter(e => e.status !== "resigned" && !e.leave_excluded), [employees]);
  // Who "Add fine" in Missing submissions may be offered for: the same list the
  // standup fine dialog lets you pick from.
  const standupFineSelectableNames = useMemo(
    () => new Set(standupFineSelectableEmployees.map((e) => e.name)),
    [standupFineSelectableEmployees]
  );
  const router = useRouter();
  const [viewDate, setViewDate] = useState("");
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [isClient, setIsClient] = useState(false);
  // Must be declared before the allSubmissions useMemo that depends on it
  const [sortNewestFirst, setSortNewestFirst] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  
  // Idle Animation State
  const [idleSubmissionId, setIdleSubmissionId] = useState(null);
  const idleTimerRef = useState(null);

  // Confused Human idle overlay for enlarged view
  const [showEnlargedIdle, setShowEnlargedIdle] = useState(false);
  const enlargedIdleRef = useState(null);
  // Tracks if user has scrolled to the bottom of submissions (seen all entries)
  const hasScrolledToBottomRef = useRef(false);

  // Sticky meeting timer — restarts from 0 every time the Daily Sync view is enlarged
  const [enlargedSeconds, setEnlargedSeconds] = useState(0);
  const enlargedTimerIntervalRef = useRef(null);

  useEffect(() => {
    if (!isEnlarged) setProjectFilter("all");
  }, [isEnlarged]);

  useEffect(() => {
    if (isEnlarged) {
      setEnlargedSeconds(0);
      enlargedTimerIntervalRef.current = setInterval(() => {
        setEnlargedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (enlargedTimerIntervalRef.current) {
        clearInterval(enlargedTimerIntervalRef.current);
        enlargedTimerIntervalRef.current = null;
      }
    };
  }, [isEnlarged]);

  useEffect(() => {
    setIsClient(true);
    const todayStr = new Date().toLocaleDateString('en-CA');
    setViewDate(todayStr);
  }, []);

  const isAuthorized = user && currentEmployee && currentEmployee.status === "active";

  useEffect(() => {
    if (isLoaded && isAuthReady && !user) {
      router.replace("/login");
    }
  }, [isLoaded, isAuthReady, user, router]);

  // Handle Idle Nudge Logic in Enlarged mode (bug walking on submission cards)
  useEffect(() => {
    if (!isEnlarged || !animationsEnabled) {
      setIdleSubmissionId(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    const startIdleTimer = () => {
      setIdleSubmissionId(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        const listEl = document.querySelector('.submissions-list');
        if (!listEl) return;
        const items = Array.from(listEl.querySelectorAll('.submission-item:not(.missing)'));
        const listRect = listEl.getBoundingClientRect();
        let topmostId = null;
        let minTopOffset = Infinity;
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (rect.top >= listRect.top && rect.bottom <= listRect.bottom) {
            if (rect.top < minTopOffset) {
              minTopOffset = rect.top;
              topmostId = item.getAttribute('data-submission-id');
            }
          }
        }
        if (topmostId) setIdleSubmissionId(topmostId);
      }, 120000); // 2 minutes idle for bug
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(e => window.addEventListener(e, startIdleTimer));
    startIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, startIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isEnlarged, animationsEnabled]);

  // Confused Human overlay — appears after 4 mins idle in enlarged view,
  // but ONLY if the user hasn't already scrolled through all submissions
  useEffect(() => {
    hasScrolledToBottomRef.current = false; // reset every time enlarged toggles

    if (!isEnlarged || !animationsEnabled) {
      setShowEnlargedIdle(false);
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      return;
    }

    // Check if the submissions list has been scrolled to the bottom
    const checkScrollBottom = () => {
      const listEl = document.querySelector('.submissions-list');
      if (!listEl) return;
      const { scrollTop, scrollHeight, clientHeight } = listEl;
      if (scrollTop + clientHeight >= scrollHeight - 16) {
        hasScrolledToBottomRef.current = true;
      }
    };

    const resetEnlargedIdle = () => {
      setShowEnlargedIdle(false);
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      enlargedIdleRef.current = setTimeout(() => {
        // Only nudge if user hasn't finished scrolling through submissions
        if (!hasScrolledToBottomRef.current) {
          setShowEnlargedIdle(true);
        }
      }, 240000); // 4 minutes idle for confused human
    };

    const windowEvents = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    windowEvents.forEach(e => window.addEventListener(e, resetEnlargedIdle));

    // Attach scroll listener to the submissions list (with a short delay for DOM render)
    let listEl = null;
    const attachScrollListener = () => {
      listEl = document.querySelector('.submissions-list');
      if (listEl) listEl.addEventListener('scroll', checkScrollBottom);
    };
    const attachTimer = setTimeout(attachScrollListener, 300);

    resetEnlargedIdle();

    return () => {
      windowEvents.forEach(e => window.removeEventListener(e, resetEnlargedIdle));
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      clearTimeout(attachTimer);
      if (listEl) listEl.removeEventListener('scroll', checkScrollBottom);
    };
  }, [isEnlarged, animationsEnabled]);

  const today = useMemo(() => {
    if (!isClient) return "";
    return new Date().toLocaleDateString('en-CA');
  }, [isClient]);

  // Helper to format text with Jira links
  const formatText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Regex for Jira URLs (assumed structure)
    const jiraRegex = /(https?:\/\/[^\s]+?\/browse\/([A-Z]+-\d+))/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = jiraRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add the Jira link
      const url = match[1];
      const jiraId = match[2];
      parts.push(
        <a 
          key={match.index} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="jira-inline-link"
        >
          {jiraId}
        </a>
      );
      
      lastIndex = jiraRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Today's Data
  const todaysFines = useMemo(() => fines.filter(f => f.date === today), [fines, today]);
  const todaysStandups = useMemo(() => standupFines.filter(f => f.date === today), [standupFines, today]);
  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some(h => h.date.startsWith(dtStr));

    if (isWeekend || isHoliday) return [];

    return leaves.filter(l => {
      if (l.dates && Array.isArray(l.dates)) {
        return l.dates.includes(dtStr);
      }
      // Legacy fallback
      return dtStr >= l.start_date && dtStr <= l.end_date;
    });
  }, [leaves, publicHolidays]);
  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [leaveTypes]);
  const allSubmissions = useMemo(() => {
    // 1. Get actual submissions for the date
    const actualSubmissions = standupSubmissions.filter(s => s.date === viewDate);

    const submittedEmails = new Set(
      actualSubmissions
        .filter(s => s.email)
        .map(s => s.email.trim().toLowerCase())
    );

    // Also build a set of first names from submissions for name-based fallback matching.
    // This handles cases like:
    //   "Pranay" (employee) ↔ "Pranay Lama Pakhrin" (standup)
    //   "Nitesh"  (employee) ↔ "Nitesh Tuladhar"    (standup)
    const submittedFirstNames = new Set(
      actualSubmissions
        .filter(s => s.name)
        .map(s => s.name.trim().split(/\s+/)[0].toLowerCase())
    );

    // 2. Find employees who have NOT submitted yet
    const missingSubmissions = (employees || [])
      .filter(emp => {
        // Skip inactive/resigned employees (e.g. Bhoomi)
        if (emp.status && emp.status !== "active") return false;

        const workEmail = emp.work_email?.trim().toLowerCase();
        const personalEmail = emp.personal_email?.trim().toLowerCase();
        const empFirstName = emp.name?.trim().split(/\s+/)[0].toLowerCase();

        // Skip employees opted out of the standup list (e.g. HR, shared accounts)
        if (emp.standup_excluded) return false;

        // Primary match: by email
        if (submittedEmails.has(workEmail) || submittedEmails.has(personalEmail)) return false;

        // Fallback match: by first name (catches full-name vs. short-name discrepancies)
        if (empFirstName && submittedFirstNames.has(empFirstName)) return false;

        return true;
      })
      .map((emp, idx) => ({
        id: `missing-${emp.id || idx}`,
        name: emp.name,
        email: emp.work_email || emp.personal_email,
        date: viewDate,
        isMissing: true,
        answers: {},
        jira_tickets: []
      }));

    // 3. Combine: Missing ones first (always), then actual ones sorted by responded_at
    const sortedActual = [...actualSubmissions].sort((a, b) =>
      sortNewestFirst
        ? new Date(b.responded_at) - new Date(a.responded_at)   // newest first
        : new Date(a.responded_at) - new Date(b.responded_at)   // oldest first (default)
    );

    return [...missingSubmissions, ...sortedActual];
  }, [standupSubmissions, viewDate, employees, isClient, sortNewestFirst]);

  // Projects with at least one staffed employee, for the submissions' project filter pills.
  const membersByProject = useMemo(() => {
    const employeesById = new Map((employees || []).map((e) => [e.id, e]));
    const map = new Map();
    for (const row of projectMembers || []) {
      const emp = employeesById.get(row.employee_id);
      if (!emp) continue;
      if (!map.has(row.project_id)) map.set(row.project_id, []);
      map.get(row.project_id).push(emp);
    }
    return map;
  }, [projectMembers, employees]);

  const staffedProjects = useMemo(
    () => (projects || []).filter((p) => (membersByProject.get(p.id) || []).length > 0),
    [projects, membersByProject]
  );

  const filteredSubmissions = useMemo(() => {
    if (projectFilter === "all") return allSubmissions;
    const members = membersByProject.get(projectFilter) || [];
    return allSubmissions.filter((s) => members.some((emp) => submissionMatchesEmployee(s, emp)));
  }, [allSubmissions, projectFilter, membersByProject]);

  // How many people each project pill stands for on the viewed date (submitted and
  // missing), matched exactly as the filter above matches them.
  const projectCounts = useMemo(() => {
    const counts = new Map();
    for (const p of staffedProjects) {
      const members = membersByProject.get(p.id) || [];
      counts.set(p.id, allSubmissions.filter((s) => members.some((emp) => submissionMatchesEmployee(s, emp))).length);
    }
    return counts;
  }, [staffedProjects, membersByProject, allSubmissions]);

  // Searching by name lifts matches to the top rather than hiding the rest, so the
  // submitted/missing counts stay honest and you keep the context of the whole standup.
  const nameQuery = nameSearch.trim().toLowerCase();

  const { orderedSubmissions, matchCount } = useMemo(() => {
    if (!nameQuery) return { orderedSubmissions: filteredSubmissions, matchCount: 0 };

    const matches = [];
    const rest = [];
    for (const s of filteredSubmissions) {
      (s.name?.toLowerCase().includes(nameQuery) ? matches : rest).push(s);
    }
    return { orderedSubmissions: [...matches, ...rest], matchCount: matches.length };
  }, [filteredSubmissions, nameQuery]);

  const stats = useMemo(() => {
    const total = filteredSubmissions.length;
    const submitted = filteredSubmissions.filter(s => !s.isMissing).length;
    return { total, submitted, missing: total - submitted };
  }, [filteredSubmissions]);

  const handlePrevDate = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 1);
    setViewDate(d.toLocaleDateString('en-CA'));
  };

  const handleNextDate = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + 1);
    setViewDate(d.toLocaleDateString('en-CA'));
  };
  
  // Word created TODAY specifically
  const todaysWord = useMemo(() => {
    return words.find(w => w.created_at?.startsWith(today));
  }, [words, today]);

  // Form States
  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  // The person "Add fine" in Missing submissions was pressed for; "" from Quick add.
  const [standupPrefill, setStandupPrefill] = useState("");
  const [showAddWord, setShowAddWord] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);

  const [showEditFine, setShowEditFine] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [showEditStandup, setShowEditStandup] = useState(false);
  const [editingStandup, setEditingStandup] = useState(null);
  const [showEditWord, setShowEditWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [showEditLeave, setShowEditLeave] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);

  const booting = !isClient || !isLoaded || !isAuthReady || (user && !isAuthorized);
  // Stays mounted for one fade after booting finishes, over the app below it.
  const splash = useSplashExit(booting);

  if (booting) {
    return <>{splash}</>;
  }

  const openStandupFine = (name) => {
    setStandupPrefill(name);
    setShowAddStandup(true);
  };

  const viewDateLabel = viewDate === today
    ? "Today"
    : (viewDate ? new Date(viewDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "...");

  // Missing people get their own panel; the enlarged view, which covers that panel,
  // keeps them at the top of its list as before.
  const missingSubmissions = orderedSubmissions.filter((s) => s.isMissing);
  const listedSubmissions = isEnlarged ? orderedSubmissions : orderedSubmissions.filter((s) => !s.isMissing);
  // A standup fine from Quick add is always dated today, so a person is only offered one
  // while today's standup is on screen.
  const canFineMissing = canManageFines && viewDate === today;

  // The signed-in user's avatar is the orange one.
  const myEmails = new Set(
    [currentEmployee?.work_email, currentEmployee?.personal_email]
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase())
  );
  const isMe = (name, email) =>
    (!!email && myEmails.has(email.trim().toLowerCase())) || (!!name && name === currentEmployee?.name);

  // Summary figures.
  const missingNames = missingSubmissions.map((s) => s.name?.trim().split(/\s+/)[0]).filter(Boolean);
  const missingSub = missingNames.length === 0
    ? "everyone is in"
    : missingNames.slice(0, 3).join(", ") + (missingNames.length > 3 ? ` +${missingNames.length - 3} more` : "");
  const leaveCounts = activeLeaves.reduce((acc, l) => {
    if (LEAVE_COUNT_LABELS[l.type]) acc[l.type] = (acc[l.type] || 0) + 1;
    return acc;
  }, {});
  const leaveSub = activeLeaves.length === 0
    ? "full strength today"
    : Object.keys(LEAVE_COUNT_LABELS)
        .filter((type) => leaveCounts[type])
        .map((type) => `${leaveCounts[type]} ${LEAVE_COUNT_LABELS[type]}`)
        .join(" · ");
  const lateTotal = todaysFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const lateUnpaid = todaysFines.filter((f) => f.status === "unpaid").length;
  const lateSub = todaysFines.length === 0
    ? "all on time today"
    : `Rs. ${lateTotal} · ${lateUnpaid ? `${lateUnpaid} unpaid` : "all paid"}`;

  return (
    <>
    {splash}
    <div className="meeting-layout">
      {/* This route sits outside the app shell: the slim top bar of the standalone pages. */}
      <header className="glass poker-standalone-bar meeting-topbar">
        <div className="poker-standalone-brand">
          <Image src="/logo.png" alt="" width={32} height={32} className="poker-bar-logo" />
          <h1 className="meeting-topbar-title">Daily Sync</h1>
          <span className="meeting-live">
            <span className="meeting-live-dot" aria-hidden="true" />
            Live
          </span>
        </div>
        <MeetingClock today={today} />
        <div className="meeting-topbar-actions">
          <a
            href={MEETING_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary meeting-topbar-link"
          >
            <Icon name="external" size={16} strokeWidth={2} />
            Meeting Link
          </a>
          <Link href="/" className="btn btn-orange meeting-topbar-link">
            Exit Meeting
          </Link>
        </div>
      </header>

      <main className="meeting-main">
        <div className="meeting-banners">
          <EventBanner />
          <ArcheryBanner />
          <NewFiscalYearBanner />
          <DashainBanner />
        </div>

        <div className="meeting-row meeting-row-top">
          <section className="meeting-figures" aria-label="Today at a glance">
            <StatsCard label="Submitted" value={`${stats.submitted} / ${stats.total}`} sub={viewDate === today ? "standups in for today" : `standups in for ${viewDateLabel}`} color={FIGURE_COLORS.submitted} />
            <StatsCard label="Missing" value={stats.missing} sub={missingSub} color={FIGURE_COLORS.missing} />
            <StatsCard label="On leave" value={activeLeaves.length} sub={leaveSub} color={FIGURE_COLORS.leave} />
            <StatsCard label="Late today" value={todaysFines.length} sub={lateSub} color={FIGURE_COLORS.late} />
          </section>
          <section className="glass meeting-quick" aria-label="Quick add">
            <span className="eyebrow">Quick add</span>
            <div className="meeting-quick-grid">
              {canManageFines && (
                <>
                  <button type="button" className="btn btn-secondary meeting-quick-btn" onClick={() => setShowAddFine(true)}>
                    <Icon name="plus" size={16} strokeWidth={2.2} />
                    Late Fine
                  </button>
                  <button type="button" className="btn btn-secondary meeting-quick-btn" onClick={() => openStandupFine("")}>
                    <Icon name="plus" size={16} strokeWidth={2.2} />
                    Standup Fine
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary meeting-quick-btn" onClick={() => setShowAddLeave(true)}>
                <Icon name="plus" size={16} strokeWidth={2.2} />
                Leave
              </button>
              {!todaysWord && (
                <button type="button" className="btn btn-secondary meeting-quick-btn" onClick={() => setShowAddWord(true)}>
                  <Icon name="plus" size={16} strokeWidth={2.2} />
                  Set Word
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="meeting-row">
          {/* STANDUP SUBMISSIONS (FROM SECONDARY DB) */}
          <section
            className={`glass meeting-panel submissions-card ${isEnlarged ? 'enlarged' : ''}`}
            aria-labelledby="meeting-subs-title"
          >
            {isEnlarged && showEnlargedIdle && (
              <ConfusedHuman onDismiss={() => setShowEnlargedIdle(false)} />
            )}
            {isEnlarged && (
              <div className="enlarged-timer">
                <Icon name="clock" size={18} strokeWidth={2} />
                {formatElapsed(enlargedSeconds)}
              </div>
            )}
            <div className="meeting-panel-head">
              <h2 id="meeting-subs-title" className="meeting-panel-title">Daily submissions</h2>
              <span className="pill pill-green meeting-pill-lg">
                {stats.submitted} / {stats.total} submitted
              </span>
              <div className="meeting-tools">
                <label className="meeting-search">
                  <Icon name="search" size={16} strokeWidth={2} />
                  <input
                    type="text"
                    aria-label="Search name"
                    placeholder="Search name…"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                  />
                  {nameQuery && (
                    <button
                      type="button"
                      className="meeting-search-clear"
                      onClick={() => setNameSearch("")}
                      aria-label="Clear search"
                      title="Clear search"
                    >
                      <Icon name="x" size={14} strokeWidth={2} />
                    </button>
                  )}
                </label>
                {nameQuery && (
                  <span className="meeting-search-count">
                    {matchCount === 0 ? "no match" : `${matchCount} matched`}
                  </span>
                )}
                <div className="meeting-date-nav" role="group" aria-label="Date">
                  <button type="button" className="meeting-date-btn" onClick={handlePrevDate} aria-label="Previous day" title="Previous day">
                    <Icon name="chevron-left" size={16} strokeWidth={2} />
                  </button>
                  <span className="meeting-date-label">{viewDateLabel}</span>
                  <button
                    type="button"
                    className="meeting-date-btn"
                    onClick={handleNextDate}
                    disabled={viewDate >= today}
                    aria-label="Next day"
                    title="Next day"
                  >
                    <Icon name="chevron-right" size={16} strokeWidth={2} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSortNewestFirst(p => !p)}
                  title={sortNewestFirst ? "Showing: Last submitted first" : "Showing: First submitted first"}
                >
                  {sortNewestFirst ? "Latest first" : "Earliest first"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEnlarged(!isEnlarged)}
                  title={isEnlarged ? "Minimize" : "Enlarge"}
                >
                  {isEnlarged && <Icon name="x" size={16} strokeWidth={2} />}
                  {isEnlarged ? "Minimize" : "Enlarge"}
                </button>
              </div>
            </div>
            {staffedProjects.length > 0 && (
              <div className="meeting-project-pills" role="group" aria-label="Filter by project">
                <button
                  type="button"
                  className={`meeting-project-pill ${projectFilter === "all" ? "active" : ""}`}
                  aria-pressed={projectFilter === "all"}
                  onClick={() => setProjectFilter("all")}
                >
                  All
                  <span className="meeting-project-count">{allSubmissions.length}</span>
                </button>
                {staffedProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`meeting-project-pill ${projectFilter === p.id ? "active" : ""}`}
                    aria-pressed={projectFilter === p.id}
                    onClick={() => setProjectFilter(p.id)}
                    title={`Show standups for ${p.name}`}
                  >
                    {p.name}
                    <span className="meeting-project-count">{projectCounts.get(p.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="submissions-list" onScroll={() => window.dispatchEvent(new Event('mousemove'))}>
              {listedSubmissions.length > 0 ? (
                listedSubmissions.map((s, index) => {
                  const subId = s.id || `sub-${index}`;
                  const isIdleTarget = idleSubmissionId === subId;
                  const visibleTickets = (s.jira_tickets || []).filter(t => {
                    const st = (typeof t === 'object' ? t.status : null)?.toLowerCase() ?? '';
                    return !HIDDEN_TICKET_STATUSES.includes(st);
                  });

                  return (
                    <article
                      key={subId}
                      data-submission-id={subId}
                      className={`submission-item ${s.isMissing ? 'missing' : ''} ${
                        nameQuery && s.name?.toLowerCase().includes(nameQuery) ? 'search-match' : ''
                      }`}
                    >
                      {isIdleTarget && <IdleNudge phrases={NUDGE_PHRASES} />}
                      <div className="submission-header">
                        <MeetingAvatar name={s.name} isMe={isMe(s.name, s.email)} />
                        <h3 className="submission-user">{s.name}</h3>
                        {s.isMissing && <span className="pill pill-red">Not submitted</span>}
                        {!s.isMissing && (
                          <span className={`pill ${s.source === "tracker" ? "pill-violet" : "pill-blue"} submission-source`}>
                            {s.source === "tracker" ? "Tracker" : "HeuBot"}
                          </span>
                        )}
                        {!s.isMissing && s.responded_at && (
                          <span className="submission-time">
                            {new Date(s.responded_at).toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {s.isMissing ? (
                        <p className="submission-missing-note">No standup update received for this date.</p>
                      ) : (
                        <div className="submission-body">
                          <dl className="submission-content">
                            {standupQuestions.length > 0 ? (
                              standupQuestions.map((q, qIndex) => {
                                const answers = s.answers || {};
                                const answer = answers[`question_${q.id}`] ||
                                             answers[q.id] ||
                                             answers[q.question] ||
                                             answers[q.sort_order] ||
                                             (q.sort_order ? answers[q.sort_order.toString()] : null);

                                return (
                                  <div key={`submission-${index}-q-${qIndex}`} className="submission-qa">
                                    <dt className="qa-label">{q.question}</dt>
                                    <dd className="ans-text">
                                      {answer && String(answer).trim() ? (
                                        typeof answer === 'object' ? JSON.stringify(answer) : formatText(String(answer))
                                      ) : (
                                        <span className="ans-empty">No answer provided</span>
                                      )}
                                    </dd>
                                  </div>
                                );
                              })
                            ) : (
                              // If no questions fetched, show raw answers
                              Object.entries(s.answers || {}).map(([key, value], ansIdx) => (
                                <div key={`submission-${index}-ans-${ansIdx}`} className="submission-qa">
                                  <dt className="qa-label">{key}</dt>
                                  <dd className="ans-text">
                                    {typeof value === 'object' ? JSON.stringify(value) : formatText(String(value || ""))}
                                  </dd>
                                </div>
                              ))
                            )}
                          </dl>
                          {/* Jira tickets sit OUTSIDE submission-content so its scroll cap never hides them */}
                          {visibleTickets.length > 0 && (
                            <div className="jira-section">
                              <span className="jira-label">Jira Tickets</span>
                              <div className={`jira-tags${visibleTickets.length > 5 ? ' jira-tags--multi-col' : ''}`}>
                                {[...visibleTickets].sort((a, b) => {
                                  const aStatus = (typeof a === 'object' ? a.status : null)?.toLowerCase() ?? '';
                                  const bStatus = (typeof b === 'object' ? b.status : null)?.toLowerCase() ?? '';
                                  return (TICKET_STATUS_ORDER[aStatus] ?? 99) - (TICKET_STATUS_ORDER[bStatus] ?? 99);
                                }).map((t, tIdx) => {
                                  const ticketKey = typeof t === 'object' ? (t.key || t.summary || "Ticket") : t;
                                  const ticketStatus = typeof t === 'object' ? (t.status || null) : null;
                                  const ticketUrl = typeof t === 'object' ? safeTicketUrl(t.url) : null;
                                  const statusClass = ticketStatus
                                    ? `jira-status jira-status--${ticketStatus.toLowerCase().replace(/\s+/g, '-')}`
                                    : null;
                                  return (
                                    <span key={`jira-${index}-${tIdx}`} className="jira-tag">
                                      <span className="jira-tag-row">
                                        {ticketUrl ? (
                                          <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="jira-tag-key">
                                            {ticketKey}
                                          </a>
                                        ) : (
                                          <span className="jira-tag-key">{ticketKey}</span>
                                        )}
                                        {ticketStatus && (
                                          <span className={statusClass}>{ticketStatus}</span>
                                        )}
                                      </span>
                                      {typeof t === 'object' && t.summary && (
                                        <span className="jira-summary">{t.summary}</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="empty-msg">
                  {projectFilter === "all"
                    ? "No submissions for this date."
                    : "No one on this project has a standup for this date."}
                </p>
              )}
            </div>
          </section>

          <div className="meeting-side">
            <section className="glass meeting-panel meeting-side-panel meeting-missing" aria-labelledby="meeting-missing-title">
              <div className="meeting-panel-head">
                <h2 id="meeting-missing-title" className="meeting-panel-title meeting-panel-title-sm">Missing submissions</h2>
                <span className="pill pill-red meeting-pill-md">{stats.missing} missing</span>
              </div>
              {missingSubmissions.length === 0 ? (
                <p className="empty-msg">Everyone has submitted.</p>
              ) : (
                <ul className="meeting-people">
                  {missingSubmissions.map((s) => (
                    <li
                      key={s.id}
                      className={`meeting-person ${nameQuery && s.name?.toLowerCase().includes(nameQuery) ? 'search-match' : ''}`}
                    >
                      <MeetingAvatar name={s.name} isMe={isMe(s.name, s.email)} />
                      <div className="meeting-person-text">
                        <span className="meeting-person-name">{s.name}</span>
                        <span className="meeting-person-sub">No standup update received for this date.</span>
                      </div>
                      {canFineMissing && standupFineSelectableNames.has(s.name) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm meeting-fine-btn"
                          onClick={() => openStandupFine(s.name)}
                          aria-label={`Add standup fine for ${s.name}`}
                        >
                          Add fine
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ACTIVE LEAVES */}
            <section className="glass meeting-panel meeting-side-panel" aria-labelledby="meeting-leave-title">
              <div className="meeting-panel-head">
                <h2 id="meeting-leave-title" className="meeting-panel-title meeting-panel-title-sm">On leave today</h2>
                <span className="pill pill-cyan meeting-pill-md">{activeLeaves.length} away</span>
              </div>
              {activeLeaves.length === 0 ? (
                <p className="empty-msg">Full strength today!</p>
              ) : (
                <ul className="meeting-people">
                  {activeLeaves.map((l, index) => {
                    const segment = parseHalfDaySegment(l);
                    const name = l.employee_name?.trim() ? l.employee_name : "Unknown";
                    const duration = [MEETING_TYPE_LABELS[l.type], segment && MEETING_SEGMENT_LABELS[segment]]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={l.id ?? `leave-item-${index}`} className="meeting-person">
                        <MeetingAvatar name={name} isMe={isMe(l.employee_name)} />
                        <div className="meeting-person-text">
                          <span className="meeting-person-name">{name}</span>
                          <div className="meeting-person-pills">
                            {duration && <span className="pill pill-cyan">{duration}</span>}
                            <span className="pill pill-gray">{leaveTypeById.get(l.leave_type_id)?.name || "Uncategorized"}</span>
                          </div>
                        </div>
                        {canManageLeave(l) && (
                          <div className="meeting-actions">
                            <button
                              type="button"
                              className="btn-icon btn-sm"
                              onClick={() => { setEditingLeave(l); setShowEditLeave(true); }}
                              aria-label={`Edit leave for ${name}`}
                              title="Edit"
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon btn-sm meeting-delete"
                              onClick={async () => { if (await confirmDialog("Delete leave?", { danger: true })) deleteLeave(l.id); }}
                              aria-label={`Delete leave for ${name}`}
                              title="Delete"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
                              
            {/* WORD OF THE DAY */}
            <section className="glass meeting-panel meeting-side-panel meeting-word" aria-labelledby="meeting-word-title">
              <div className="meeting-panel-head">
                <Icon name="book" size={20} className="meeting-word-icon" />
                <h2 id="meeting-word-title" className="meeting-panel-title meeting-panel-title-sm">Word of the meeting</h2>
                {todaysWord && isAdmin && (
                  <div className="meeting-actions">
                    <button
                      type="button"
                      className="btn-icon btn-sm"
                      onClick={() => { setEditingWord(todaysWord); setShowEditWord(true); }}
                      aria-label="Edit word"
                      title="Edit Word"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-sm meeting-delete"
                      onClick={async () => { if (await confirmDialog("Delete word?", { danger: true })) deleteWord(todaysWord.id); }}
                      aria-label="Delete word"
                      title="Delete Word"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                )}
              </div>
              {todaysWord ? (
                <div className="meeting-word-body">
                  <div className="meeting-word-main">
                    <span className="meeting-word-text">{todaysWord.word}</span>
                    {todaysWord.phonetic && <span className="meeting-word-phonetic">({todaysWord.phonetic})</span>}
                  </div>
                  {todaysWord.translation && (
                    <p className="meeting-word-translation">Translation: <strong>{todaysWord.translation}</strong></p>
                  )}
                  <p className="meeting-word-definition">{todaysWord.definition}</p>
                  {todaysWord.example && (
                    <blockquote className="meeting-word-example">&ldquo;{todaysWord.example}&rdquo;</blockquote>
                  )}
                </div>
              ) : (
                <div className="meeting-word-empty">
                  <p className="empty-msg">No word shared for this meeting yet.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddWord(true)}>
                    <Icon name="plus" size={16} strokeWidth={2} />
                    Set Meeting Word
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="meeting-row">
          {/* SHOUTOUTS & KUDOS */}
          <MeetingShoutouts today={today} />

          <div className="meeting-side meeting-side-records">
            {/* LATE FINES */}
            <section className="glass meeting-panel meeting-side-panel" aria-labelledby="meeting-fines-title">
              <div className="meeting-panel-head">
                <h2 id="meeting-fines-title" className="meeting-panel-title meeting-panel-title-sm">Today&apos;s late fines</h2>
              </div>
              {todaysFines.length === 0 ? (
                <p className="empty-msg">All on time today!</p>
              ) : (
                <ul className="meeting-people">
                  {todaysFines.map((f, index) => (
                    <li key={f.id ?? `fine-item-${index}`} className="meeting-person">
                      <MeetingAvatar name={f.employee_name} isMe={isMe(f.employee_name)} />
                      <div className="meeting-person-text">
                        <span className="meeting-person-name">{f.employee_name}</span>
                      </div>
                      <span className="meeting-amount">Rs. {f.amount}</span>
                      <span className={`status-badge status-static ${f.status}`}>{f.status}</span>
                      {canManageFines && (
                        <div className="meeting-actions">
                          <button
                            type="button"
                            className="btn-icon btn-sm"
                            onClick={() => { setEditingFine(f); setShowEditFine(true); }}
                            aria-label={`Edit fine for ${f.employee_name}`}
                            title="Edit"
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-sm meeting-delete"
                            onClick={async () => { if (await confirmDialog("Delete fine?", { danger: true })) deleteFine(f.id); }}
                            aria-label={`Delete fine for ${f.employee_name}`}
                            title="Delete"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* STANDUP FINES */}
            <section className="glass meeting-panel meeting-side-panel" aria-labelledby="meeting-standups-title">
              <div className="meeting-panel-head">
                <h2 id="meeting-standups-title" className="meeting-panel-title meeting-panel-title-sm">Standup status</h2>
              </div>
              {todaysStandups.length === 0 ? (
                <p className="empty-msg">No standup fines yet.</p>
              ) : (
                <ul className="meeting-people">
                  {todaysStandups.map((s, index) => (
                    <li key={s.id ?? `standup-item-${index}`} className="meeting-person">
                      <MeetingAvatar name={s.employee_name} isMe={isMe(s.employee_name)} />
                      <div className="meeting-person-text">
                        <span className="meeting-person-name">{s.employee_name}</span>
                      </div>
                      <span className={`status-badge status-static ${s.status}`}>{s.status}</span>
                      {canManageFines && (
                        <div className="meeting-actions">
                          <button
                            type="button"
                            className="btn-icon btn-sm"
                            onClick={() => { setEditingStandup(s); setShowEditStandup(true); }}
                            aria-label={`Edit standup record for ${s.employee_name}`}
                            title="Edit"
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-sm meeting-delete"
                            onClick={async () => { if (await confirmDialog("Delete record?", { danger: true })) deleteStandupFine(s.id); }}
                            aria-label={`Delete standup record for ${s.employee_name}`}
                            title="Delete"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* QUICK MODALS - REUSING LOGIC AND CLASSES */}
      {showAddFine && (
        <QuickAddFineModal
          isOpen={showAddFine}
          onClose={() => setShowAddFine(false)}
          addFine={addFine}
          employees={lateFineSelectableEmployees}
          today={today}
          fines={fines}
          fineSeasons={fineSeasons}
        />
      )}
      {showAddStandup && (
        <QuickAddStandupModal
          isOpen={showAddStandup}
          onClose={() => setShowAddStandup(false)}
          addStandupFine={addStandupFine}
          employees={standupFineSelectableEmployees}
          today={today}
          standupFines={standupFines}
          initialName={standupPrefill}
        />
      )}

      <EditFineModal 
        isOpen={showEditFine} 
        onClose={() => { setShowEditFine(false); setEditingFine(null); }} 
        fine={editingFine}
      />

      <EditStandupModal
        isOpen={showEditStandup}
        onClose={() => { setShowEditStandup(false); setEditingStandup(null); }}
        record={editingStandup}
      />

      <EditWordModal
        isOpen={showEditWord}
        onClose={() => { setShowEditWord(false); setEditingWord(null); }}
        word={editingWord}
      />

      <EditLeaveModal
        isOpen={showEditLeave}
        onClose={() => { setShowEditLeave(false); setEditingLeave(null); }}
        leave={editingLeave}
      />

      {showAddWord && (
        <QuickAddWordModal
          isOpen={showAddWord}
          onClose={() => setShowAddWord(false)}
          addWord={addWord}
          seasons={wordSeasons}
          words={words}
        />
      )}
      {showAddLeave && (
        <QuickAddLeaveModal
          isOpen={showAddLeave}
          onClose={() => setShowAddLeave(false)}
          addLeave={addLeave}
          employees={leaveSelectableEmployees}
          today={today}
          leaves={leaves}
          leaveSeasons={leaveSeasons}
          leaveTypes={leaveTypes}
          publicHolidays={publicHolidays}
          isAdmin={isAdmin}
          currentEmployee={currentEmployee}
        />
      )}
    </div>
    </>
  );
}

// Clock, date (AD and BS) and time in the meeting, for the top bar. It ticks on its own,
// so only this part of the page renders every second.
function MeetingClock({ today }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const day = useMemo(() => meetingDayLabel(today), [today]);
  const bs = useMemo(() => formatBs(today), [today]);

  return (
    <div className="meeting-clock">
      <time className="meeting-clock-time" role="timer" aria-label="Current time">
        {CLOCK_FORMAT.format(now)}
      </time>
      <div className="meeting-clock-date">
        <span className="meeting-clock-day">{day}</span>
        {bs && <span className="meeting-clock-bs">{bs} BS</span>}
      </div>
      <span className="meeting-elapsed">
        <Icon name="clock" size={14} strokeWidth={2} />
        In meeting
        <span className="meeting-elapsed-time">{formatElapsed(Math.floor((now - startedAt) / 1000))}</span>
      </span>
    </div>
  );
}

// COMPACT INLINE MODALS FOR MEETING MODE
function QuickAddFineModal({ isOpen, onClose, addFine, employees, today, fines, fineSeasons }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(25);
  const [error, setError] = useState("");

  const latestFineSeasonId = useMemo(() => {
    if (!fineSeasons || fineSeasons.length === 0) return null;
    return [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id;
  }, [fineSeasons]);

  // A late fine is one per person per day, whatever the amount.
  const existingFine = findExistingLateFine(fines, name, today);

  const hSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    const { error: submitError } = await addFine({
      name,
      amount: parseFloat(amount),
      date: today,
      status: "unpaid",
      seasonId: latestFineSeasonId,
    });

    if (submitError) {
      setError(submitError.message || "Failed to save the fine. Please try again.");
      return;
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="wallet" size={20} /></span>
          <h2>Fast fine</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label htmlFor="quick-fine-employee">Employee</label>
            <select id="quick-fine-employee" value={name} onChange={e => { setName(e.target.value); setError(""); }} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Amount (Rs.)</label>
            <div className="amount-preset-options">
              {[25, 50].map(val => (
                <label key={val} className={`amount-chip ${amount == val ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="fineAmount"
                    value={val}
                    checked={amount == val}
                    onChange={() => { setAmount(val); setError(""); }}
                  />
                  <span>RS {val}</span>
                </label>
              ))}
            </div>
          </div>
          {existingFine && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon"><Icon name="alert" size={18} /></span>
              <div className="duplicate-warning-text">
                <strong>Already fined for this day</strong>
                <p>
                  <strong>{name}</strong> already has a RS {existingFine.amount} late fine today.
                  A late fine is one per person per day.
                </p>
              </div>
            </div>
          )}
          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!!existingFine}>Save Fine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickAddWordModal({ isOpen, onClose, addWord, seasons, words }) {
  const [word, setWord] = useState("");
  const [def, setDef] = useState("");

  // Checked across every season, not just the one being filed into — a word already
  // used in an earlier season shouldn't get re-added under a new one.
  const isDuplicate = useMemo(() => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return false;
    return (words || []).some((w) => w.word?.trim().toLowerCase() === trimmed);
  }, [word, words]);

  // Default to the most recently CREATED season. Sorting by id assumed higher id = newer,
  // which is not guaranteed (seasons can be deleted and re-created), and defaulting to an
  // older season silently files the word under a past season.
  const latestSeasonId = useMemo(() => {
    if (!seasons || seasons.length === 0) return "";
    return [...seasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id;
  }, [seasons]);

  const [seasonId, setSeasonId] = useState("");

  // Update seasonId when latestSeasonId is determined
  useMemo(() => {
    if (latestSeasonId && !seasonId) {
      setSeasonId(latestSeasonId);
    }
  }, [latestSeasonId]);

  const hSubmit = (e) => {
    e.preventDefault();
    if (!word || !def || !seasonId || isDuplicate) return;
    addWord({ word, definition: def, seasonId });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="book" size={20} /></span>
          <h2>Fast word</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label htmlFor="quick-word-season">Season</label>
            <select id="quick-word-season" value={seasonId} onChange={e => setSeasonId(e.target.value)} required>
              <option value="">Select...</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="form-group-interactive">
            <label htmlFor="quick-word-word">Word</label>
            <input id="quick-word-word" type="text" value={word} onChange={e => setWord(e.target.value)} required />
            {isDuplicate && <div className="form-error" role="alert"><Icon name="alert" size={16} />Oops, this one has already been mentioned.</div>}
          </div>
          <div className="form-group-interactive">
            <label htmlFor="quick-word-definition">Definition</label>
            <textarea id="quick-word-definition" value={def} onChange={e => setDef(e.target.value)} required rows={2} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isDuplicate}>Save Word</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IdleNudge({ phrases }) {
  const [index, setIndex] = useState(0);
  const [bugType, setBugType] = useState('turtle');
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      // Randomize initial bug
      const bugs = ['turtle', 'ant', 'spider'];
      setBugType(bugs[Math.floor(Math.random() * bugs.length)]);
      
      // Randomize initial text
      setIndex(Math.floor(Math.random() * phrases.length));
      isInitialized.current = true;
    }
    
    // Change text every 5 seconds as it walks (so it's easily readable)
    const interval = setInterval(() => {
      setIndex(current => (current + 1) % phrases.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  const renderTurtle = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      {/* Back legs */}
      <g className="bug-leg-1" style={{ transformOrigin: '12px 22px' }}>
        <path d="M 12 22 Q 10 26 8 28" stroke="#166534" fill="none" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 8 28 L 5 28" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      
      {/* Front legs */}
      <g className="bug-leg-3" style={{ transformOrigin: '32px 22px' }}>
        <path d="M 32 22 Q 35 26 38 28" stroke="#166534" fill="none" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 38 28 L 41 28" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Tail */}
      <path d="M 10 20 Q 5 18 3 20" stroke="#166534" fill="none" strokeWidth="2.5" strokeLinecap="round" />

      {/* Head */}
      <ellipse cx="40" cy="18" rx="6" ry="4" fill="#166534" />
      {/* Eye */}
      <circle cx="43" cy="17" r="1" fill="#fff" />
      
      {/* Shell Base (Plastron) */}
      <ellipse cx="22" cy="22" rx="15" ry="3" fill="#854d0e" />
      
      {/* Shell (Carapace) */}
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="#22c55e" />
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="url(#turtle-shell)" opacity="0.3" />
      
      {/* Shell outline & pattern lines */}
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="none" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 12 18 C 12 10, 32 10, 32 18 Z" fill="none" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 22 8 L 22 18" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 15 11 L 10 16" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 29 11 L 34 16" stroke="#15803d" strokeWidth="1.5" />
    </svg>
  );

  const renderAnt = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      <g className="bug-leg-1" style={{ transformOrigin: '15px 22px' }}>
        <path d="M 15 22 Q 10 28 8 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-2" style={{ transformOrigin: '25px 22px' }}>
        <path d="M 25 22 Q 25 28 25 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-3" style={{ transformOrigin: '35px 22px' }}>
        <path d="M 35 22 Q 40 28 42 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <ellipse cx="14" cy="18" rx="8" ry="5" fill="#000000" />
      <ellipse cx="27" cy="18" rx="5" ry="3" fill="#000000" />
      <circle cx="38" cy="16" r="4" fill="#000000" />
      <path d="M 40 14 Q 45 10 47 12" stroke="#000000" fill="none" strokeWidth="1" strokeLinecap="round" />
      <path d="M 39 13 Q 44 8 46 9" stroke="#000000" fill="none" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );

  const renderSpider = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      <g className="bug-leg-1" style={{ transformOrigin: '23px 20px' }}>
        <path d="M 23 20 Q 15 10 10 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 25 20 Q 18 15 15 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-3" style={{ transformOrigin: '31px 20px' }}>
        <path d="M 31 20 Q 38 10 45 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 29 20 Q 35 15 38 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="27" cy="20" r="7" fill="#6b7280" />
      <circle cx="34" cy="22" r="3" fill="#6b7280" />
    </svg>
  );

  return (
    <div className="walking-nudge-container">
      <div key={index} className="nudge-speech-bubble">{phrases[index]}</div>
      <div className="bug-figure-wrapper">
        {bugType === 'turtle' && renderTurtle()}
        {bugType === 'ant' && renderAnt()}
        {bugType === 'spider' && renderSpider()}
      </div>
    </div>
  );
}

function QuickAddLeaveModal({ isOpen, onClose, addLeave, employees, today, leaves, leaveSeasons, leaveTypes, publicHolidays, isAdmin, currentEmployee }) {
  const { alertDialog } = useDialog();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("full");   // full | half | early
  const [segment, setSegment] = useState("first");    // first | second
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [overrideBalance, setOverrideBalance] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Auto-select current employee if not admin, matching AddLeaveModal's behavior
  useEffect(() => {
    if (isOpen && !isAdmin && currentEmployee && !name) {
      setName(currentEmployee.name);
    }
  }, [isOpen, isAdmin, currentEmployee, name]);

  const DURATION_OPTS = [
    { value: "full",  label: "Full Day" },
    { value: "half",  label: "Half Day" },
    { value: "early", label: "Early Leave" },
  ];

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );
  const activeLeaveTypes = (leaveTypes || []).filter((t) => t.is_active);
  const latestSeasonId = useMemo(() => {
    if (!leaveSeasons || leaveSeasons.length === 0) return null;
    return [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id;
  }, [leaveSeasons]);
  const balances = computeLeaveBalances(name, leaves, activeLeaveTypes, latestSeasonId, holidaySet);
  const defaultLeaveType = activeLeaveTypes.find((t) => !t.is_unpaid) || activeLeaveTypes[0];
  const effectiveLeaveTypeId = leaveTypeId || (defaultLeaveType ? String(defaultLeaveType.id) : "");

  const hSubmit = async (e) => {
    e.preventDefault();
    if (!name || !name.trim()) return;

    const isDuplicate = leaves.some(l =>
      l.employee_name === name &&
      l.start_date === today
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    const requestedDays = duration === "half" ? 0.5 : 1;
    const selectedBalance = balances.find((b) => String(b.id) === String(effectiveLeaveTypeId));
    if (selectedBalance && requestedDays > selectedBalance.remaining && !(isAdmin && overrideBalance)) {
      await alertDialog(`Insufficient ${selectedBalance.name} balance (${selectedBalance.remaining} remaining). Consider Unpaid Leave instead.`, { tone: "error" });
      return;
    }

    let finalReason = duration === "half" ? (segment === "first" ? "[First Half]" : "[Second Half]") : "";

    const { error: submitError } = await addLeave({
      name,
      type: duration,
      startDate: today,
      endDate: today,
      reason: finalReason,
      leaveTypeId: effectiveLeaveTypeId ? Number(effectiveLeaveTypeId) : null,
      seasonId: latestSeasonId,
    });

    if (submitError) {
      await alertDialog(`Failed to save the leave: ${submitError.message || "please try again."}`, { tone: "error" });
      return;
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="calendar" size={20} /></span>
          <h2>Fast leave (today)</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label htmlFor="quick-leave-employee">Employee</label>
            <select id="quick-leave-employee" value={name} onChange={e => setName(e.target.value)} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>

          <div className="form-group-interactive">
            <label>Duration</label>
            <div className="leave-type-options">
              {DURATION_OPTS.map(opt => (
                <label
                  key={opt.value}
                  className={`leave-type-chip ${duration === opt.value ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="quickLeaveDuration"
                    value={opt.value}
                    checked={duration === opt.value}
                    onChange={() => setDuration(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {duration === "half" && (
            <div className="form-group-interactive">
              <label>Half Day Segment</label>
              <div className="leave-type-options">
                {[
                  { value: "first", label: "First Half" },
                  { value: "second", label: "Second Half" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`leave-type-chip ${segment === opt.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="quickLeaveSegment"
                      value={opt.value}
                      checked={segment === opt.value}
                      onChange={() => setSegment(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeLeaveTypes.length > 0 && (
            <div className="form-group-interactive">
              <label htmlFor="quick-leave-category">Category</label>
              <select id="quick-leave-category" value={effectiveLeaveTypeId} onChange={e => setLeaveTypeId(e.target.value)}>
                {balances.map((b) => (
                  <option key={b.id} value={b.id} disabled={!isAdmin && b.remaining <= 0}>
                    {b.name} — {b.remaining}/{b.annual_days} left{b.is_unpaid ? " (unpaid)" : ""}
                  </option>
                ))}
              </select>
              {isAdmin && (
                <label className="leave-multiday-toggle" style={{ marginTop: "8px" }}>
                  <input
                    type="checkbox"
                    checked={overrideBalance}
                    onChange={(e) => setOverrideBalance(e.target.checked)}
                  />
                  <span>Override balance limit</span>
                </label>
              )}
            </div>
          )}

          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon"><Icon name="alert" size={18} /></span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A leave for <strong>{name}</strong> today already exists. Add it anyway?</p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setDuplicateWarning(false); onClose(); }}>Cancel</button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">Add Anyway</button>
            ) : (
              <button type="submit" className="btn btn-primary">Save Leave</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
function QuickAddStandupModal({ isOpen, onClose, addStandupFine, employees, today, standupFines, initialName = "" }) {
  // Opened from a Missing submissions row, the person comes picked — when they are someone
  // this dialog may fine.
  const [name, setName] = useState(() => (employees.some((e) => e.name === initialName) ? initialName : ""));
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState("");

  const hSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    const isDuplicate = standupFines.some(s =>
      s.employee_name === name &&
      s.date === today
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    const { error: submitError } = await addStandupFine({ name, date: today, status: "unpaid" });
    if (submitError) {
      setError(submitError.message || "Failed to save the record. Please try again.");
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="clipboard" size={20} /></span>
          <h2>Fast standup fine</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label htmlFor="quick-standup-employee">Employee</label>
            <select id="quick-standup-employee" value={name} onChange={e => setName(e.target.value)} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}

          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon"><Icon name="alert" size={18} /></span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A standup fine for <strong>{name}</strong> today already exists. Add it anyway?</p>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setDuplicateWarning(false); onClose(); }}>Cancel</button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">Add Anyway</button>
            ) : (
              <button type="submit" className="btn btn-primary">Save Standup Fine</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Confused human overlay for enlarged idle state
function ConfusedHuman({ onDismiss }) {
  return (
    <div className="confused-human-overlay" onClick={onDismiss}>
      <div className="confused-human-wrap">
        {/* Speech bubble */}
        <div className="confused-bubble">
          Let&apos;s finish the sync first!
        </div>
        <div className="confused-bubble-tail" />

        {/* SVG stick figure — confused pose */}
        <svg
          className="confused-figure"
          viewBox="0 0 120 180"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Floating question marks */}
          <text className="qmark qmark1" x="88" y="30" fontSize="18" fill="#facc15" fontWeight="900">?</text>
          <text className="qmark qmark2" x="20" y="45" fontSize="14" fill="#facc15" fontWeight="900">?</text>
          <text className="qmark qmark3" x="95" y="58" fontSize="11" fill="#facc15" fontWeight="900">?</text>

          {/* Head */}
          <circle cx="60" cy="36" r="18" stroke="var(--text-primary)" strokeWidth="3" fill="rgba(99,102,241,0.12)" />

          {/* Confused face — worried symmetric brows, wide eyes, open uncertain mouth */}
          {/* Eyes — slightly bigger for a wide "huh?" look */}
          <circle cx="53" cy="33" r="3" fill="var(--text-primary)" />
          <circle cx="67" cy="33" r="3" fill="var(--text-primary)" />
          {/* Tiny bright dot highlights in eyes */}
          <circle cx="55" cy="31" r="1" fill="rgba(255,255,255,0.7)" />
          <circle cx="69" cy="31" r="1" fill="rgba(255,255,255,0.7)" />
          {/* Both brows raised & arched inward — worried/confused, NOT stern */}
          <path d="M48 27 Q53 22 58 27" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
          <path d="M62 27 Q67 22 72 27" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
          {/* Mouth: small open oval — confused "uhh?" expression */}
          <ellipse cx="60" cy="44" rx="5" ry="3.5" fill="var(--text-primary)" opacity="0.8" />

          {/* Body */}
          <line x1="60" y1="54" x2="60" y2="110" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />

          {/* Left arm — raised and bent (scratching head) */}
          <path d="M60 65 Q40 55 38 38" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          {/* Hand scratching */}
          <circle cx="38" cy="36" r="4" stroke="var(--text-primary)" strokeWidth="2" fill="rgba(99,102,241,0.15)" />

          {/* Right arm — out to the side (shrug) */}
          <path d="M60 65 Q82 72 90 62" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          <path d="M90 62 Q96 58 94 65" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />

          {/* Left leg */}
          <path d="M60 110 Q50 135 45 155" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          {/* Right leg */}
          <path d="M60 110 Q70 135 75 155" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />

          {/* Feet */}
          <path d="M45 155 Q40 158 35 155" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 155 Q80 158 85 155" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <p className="confused-hint">click anywhere to dismiss</p>
      </div>
    </div>
  );
}

