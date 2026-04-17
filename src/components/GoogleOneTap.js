"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";

export default function GoogleOneTap() {
  const { user, isAuthReady } = useApp();
  const initialized = useRef(false);

  useEffect(() => {
    // Wait for auth session to be confirmed
    if (!isAuthReady) return;

    // If user is already signed in, we don't need to do anything here.
    if (user) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
      return;
    }

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const buildNonce = async () => {
      const nonce = btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
      );
      const encoded = new TextEncoder().encode(nonce);
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
      const hashedNonce = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { nonce, hashedNonce };
    };

    const handleCredentialResponse = async (response) => {
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          // We must use the same nonce that was used during initialization
          nonce: window.__googleLoginNonce,
        });
        if (error) {
          console.error("Sign-in error:", error.message);
        }
      } catch (err) {
        console.error("Unexpected sign-in error:", err);
      }
    };

    const initOneTap = async () => {
      if (!window.google?.accounts?.id) return false;

      const { nonce, hashedNonce } = await buildNonce();
      window.__googleLoginNonce = nonce;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        nonce: hashedNonce,
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });

      // Show the One Tap prompt
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          console.log("One Tap not displayed:", notification.getNotDisplayedReason());
        }
      });
      return true;
    };

    // Retry initialization until Google script is loaded
    let interval;
    const tryInit = async () => {
      if (await initOneTap()) {
        initialized.current = true;
        if (interval) clearInterval(interval);
      }
    };

    if (!initialized.current) {
      tryInit();
      interval = setInterval(tryInit, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, isAuthReady]);

  return null;
}
