"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

// Login.dc.html: a glass card over the aurora (root layout). Faint circuit traces sit
// behind it, copied from the artboard; they are decoration only.
const CIRCUITS = [
  "01001000 01010100 ── ┐\n01100110 01101001 │\n01101110 01100101 └─ ●\n01110011 ─────── ┐\n         └─ 0x48 ●",
  "● ── 01110011 01110100\n│ 01100001 01101110\n└──── 01100100 01110101\n       01110000 ── ●",
  "┌─ 0x10 ─┐\n● 1011 ●\n└─ 0x19 ─┘",
  "10 ── 01 ── 11\n│           │\n●── 0x2083 ──●",
];

export default function LoginPage() {
  const router = useRouter();
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "unauthorized") {
        setErrorMsg("You are unauthorized to access this page.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    // If already signed in, redirect to app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace("/");
      } else {
        setLoading(false);
        renderGoogleButton();
      }
    });

    // Listen for sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        router.replace("/");
      }
      if (event === "INITIAL_SESSION") {
        if (session?.user) router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const renderGoogleButton = () => {
    const tryRender = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return false;

      // Note: id.initialize is handled globally by GoogleOneTap component.
      // We just need to render the button here.
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: 280,
      });
      return true;
    };

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 300);
      return () => clearInterval(interval);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-circuits" aria-hidden="true">
        {CIRCUITS.map((trace, i) => (
          <div key={i} className={`login-circuit-${i + 1}`}>{trace}</div>
        ))}
      </div>

      <main className="login-main">
        <section className="glass login-card" aria-labelledby="login-title">
          <Image src="/logo.png" alt="Heubert Tracker" width={56} height={56} className="login-logo" />

          <span className="pill pill-green login-badge">
            <span className="login-badge-dot" aria-hidden="true" />
            Internal Portal
          </span>

          <h1 id="login-title" className="login-title">Heubert Tracker</h1>
          <p className="login-subtitle">
            Internal Team Accountability &amp; Record System.<br />
            Sign in with your Google account to continue.
          </p>

          {errorMsg && (
            <div className="form-error login-alert" role="alert">
              <Icon name="alert" size={16} strokeWidth={2} />
              <span>{errorMsg}</span>
            </div>
          )}

          {signingIn ? (
            <div className="login-signing-in" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>Signing you in…</span>
            </div>
          ) : (
            <div className="login-google">
              <div ref={buttonRef} />
            </div>
          )}
          <span className="login-hint mono">Use the Google account your team registered</span>

          <ul className="login-features">
            <li className="login-feature">
              <span className="login-feature-icon"><Icon name="wallet" size={16} /></span>
              <span>Track late fines &amp; standup records</span>
            </li>
            <li className="login-feature">
              <span className="login-feature-icon"><Icon name="users" size={16} /></span>
              <span>Manage employee profiles &amp; history</span>
            </li>
            <li className="login-feature">
              <span className="login-feature-icon"><Icon name="calendar" size={16} /></span>
              <span>View and record team leaves</span>
            </li>
          </ul>

          <p className="login-footer">
            Access restricted to Heubert team members only
          </p>
        </section>
      </main>
    </div>
  );
}
