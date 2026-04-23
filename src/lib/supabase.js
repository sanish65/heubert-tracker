import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Second Supabase for Standup Records
const standupUrl = process.env.NEXT_PUBLIC_STANDUP_SUPABASE_URL
const standupKey = process.env.NEXT_PUBLIC_STANDUP_SUPABASE_ANON_KEY

export const supabaseStandup = createClient(standupUrl, standupKey)
