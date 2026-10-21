"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "./Icon";
import { getNepalParts, isStandupWindowOpen, findTodaysSubmission } from "@/lib/standupWindow";

export default function StandupFloatingButton({ onOpen }) {
  const { standupSubmissions, currentEmployee, user } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nepal = getNepalParts(now);
  const alreadySubmitted = Boolean(findTodaysSubmission(standupSubmissions, nepal.dateStr, currentEmployee, user));

  if (!isStandupWindowOpen(nepal)) return null;

  return (
    <button
      type="button"
      className="btn btn-primary standup-fab"
      onClick={onOpen}
      title={
        alreadySubmitted
          ? "Edit today's standup — window open 9:00–9:30 AM Nepal time"
          : "Fill today's standup — open 9:00–9:30 AM Nepal time"
      }
    >
      <Icon name="clipboard" size={18} strokeWidth={2} />
      <span>{alreadySubmitted ? "Edit Standup" : "Standup"}</span>
    </button>
  );
}
