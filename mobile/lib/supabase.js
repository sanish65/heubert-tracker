import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Second Supabase project for Standup Records (read-only from this app)
const standupUrl = process.env.EXPO_PUBLIC_STANDUP_SUPABASE_URL;
const standupKey = process.env.EXPO_PUBLIC_STANDUP_SUPABASE_ANON_KEY;

export const supabaseStandup = createClient(standupUrl, standupKey, {
  auth: { persistSession: false, detectSessionInUrl: false },
});

// Base URL of the deployed Next.js web app — /api/poker, /api/retro and
// /api/memories are called directly instead of re-implementing that backend.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";
