import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isActiveEmployeeEmail, photosByName } from "@/lib/avatar";

// GET /api/avatars → { photos: { [employee name]: Google photo URL } }
//
// Everyone signs in with Google, so each person's profile photo sits in Supabase Auth,
// which the browser cannot read for anyone but itself. This reads it with the service-role
// client and returns names and photo URLs only: no email, id or other account field ever
// leaves the server. Only Google-hosted photo URLs are passed on (src/lib/avatar.js),
// because user_metadata is editable by its own user.
//
// The caller's identity is their Supabase JWT, and they must be an active employee, the
// rule sign-in applies; it is checked in code against the same employee list the photos
// are matched to, so no caller value is spliced into a query.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Auth users are listed a page at a time until a short page. The page cap is a backstop
// far above this office's size, so a listing that never ends cannot loop for ever.
const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 25;
const MAX_EMPLOYEES = 1000;

// Every employee sees the same map, so it may sit in the browser's own cache for ten
// minutes; Vary keeps a cached copy from answering a different session's token.
const CACHE_HEADERS = { "Cache-Control": "private, max-age=600", Vary: "Authorization" };

async function getCallerEmail(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/, "");
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return null;
  return user.email;
}

async function listAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < USERS_PER_PAGE) return users;
  }
  console.warn(`Avatar photos: stopped listing auth users after ${MAX_USER_PAGES} pages.`);
  return users;
}

export async function GET(request) {
  try {
    // Authenticate before anything else, so an anonymous caller costs one token check.
    const callerEmail = await getCallerEmail(request);
    if (!callerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: employees, error } = await admin
      .from("employees")
      .select("name, work_email, personal_email, status")
      .limit(MAX_EMPLOYEES);
    if (error) throw error;

    if (!isActiveEmployeeEmail(employees, callerEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await listAuthUsers(admin);
    return NextResponse.json({ photos: photosByName(employees, users) }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Avatar photos error:", error);
    return NextResponse.json({ error: "Could not load profile photos." }, { status: 500 });
  }
}
