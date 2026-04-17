"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

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
        text: "signin_with",
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
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        .login-bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%);
          top: -200px; left: -100px;
          animation: orbFloat 8s ease-in-out infinite;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
          bottom: -100px; right: -50px;
          animation: orbFloat 10s ease-in-out infinite reverse;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%);
          top: 40%; left: 60%;
          animation: orbFloat 12s ease-in-out infinite;
        }

        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.97); }
        }

        .login-card {
          position: relative;
          z-index: 1;
          background: rgba(17, 24, 39, 0.75);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 48px 44px;
          width: 100%;
          max-width: 440px;
          backdrop-filter: blur(24px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1);
          text-align: center;
          animation: cardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 18px;
          font-size: 28px;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(99,102,241,0.35);
        }

        .login-title {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }

        .login-subtitle {
          font-size: 0.9rem;
          color: #9ca3af;
          margin-bottom: 36px;
          line-height: 1.5;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 28px 0;
        }
        .login-divider::before,
        .login-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .login-divider span {
          color: #6b7280;
          font-size: 0.78rem;
        }

        .google-btn-wrapper {
          display: flex;
          justify-content: center;
          min-height: 44px;
        }

        .login-signing-in {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #9ca3af;
          font-size: 0.88rem;
          padding: 12px 0;
        }

        .login-features {
          margin-top: 36px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .login-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.83rem;
          color: #6b7280;
          text-align: left;
        }

        .login-feature-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(99,102,241,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }

        .login-footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-size: 0.75rem;
          color: #4b5563;
        }

        .login-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.2);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 0.75rem;
          color: #22c55e;
          font-weight: 500;
          margin-bottom: 20px;
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse 2s ease infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div className="login-page">
        {/* Background orbs */}
        <div className="login-bg-orb orb-1" />
        <div className="login-bg-orb orb-2" />
        <div className="login-bg-orb orb-3" />

        <div className="login-card">
          <div className="login-logo">⏰</div>

          <div className="login-badge">
            <span className="badge-dot" />
            Internal Portal
          </div>

          <h1 className="login-title">Heubert Tracker</h1>
          <p className="login-subtitle">
            Internal Team Accountability &amp; Record System.<br />
            Sign in with your Google account to continue.
          </p>

          {signingIn ? (
            <div className="login-signing-in">
              <div className="spinner" />
              <span>Signing you in…</span>
            </div>
          ) : (
            <div className="google-btn-wrapper">
              <div ref={buttonRef} />
            </div>
          )}

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">📊</div>
              <span>Track late fines &amp; standup records</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">👥</div>
              <span>Manage employee profiles &amp; history</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">🏖️</div>
              <span>View and record team leaves</span>
            </div>
          </div>

          <div className="login-footer">
            Access restricted to Heubert team members only
          </div>
        </div>
      </div>
    </>
  );
}
