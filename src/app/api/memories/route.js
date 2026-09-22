import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRK  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Returns an authenticated Supabase client.
// With the service-role key: bypasses RLS entirely.
// Without it: passes the user JWT in global headers so auth.email() is
// available for RLS policies.
function makeClient(userToken) {
  if (SRK) {
    return createClient(URL, SRK, { auth: { persistSession: false } });
  }
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth:   { persistSession: false },
  });
}

// Verifies the bearer token and returns the user's email.
async function getCallerEmail(request) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/, '');
  if (!token) return null;
  // Use a plain anon client just to validate the JWT — no RLS needed here.
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return null;
  return user.email;
}

// A write that RLS filters out is not an error to PostgREST — it just touches zero
// rows and returns 204. Without the service-role key every write here goes through
// RLS as the caller, so "no error" alone can't be trusted: the row has to come back
// for the write to have actually landed.
const BLOCKED =
  'The database rejected the write. The memories table is missing an RLS policy ' +
  'that lets an author change their own row (see scripts/memories-schema.sql), ' +
  'or SUPABASE_SERVICE_ROLE_KEY is not set on the server.';

// Loads the row and checks the caller owns it. Returns a NextResponse to bail out
// with, or null when the caller is clear to write.
async function denyUnlessOwner(db, id, callerEmail) {
  // maybeSingle, not single: when RLS hides the row `single` raises PGRST116 and the
  // caller gets a 500 about JSON coercion instead of a plain "not found".
  const { data: existing, error } = await db
    .from('memories').select('id, author_email').eq('id', id).maybeSingle();

  if (error)
    return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
  if (!existing)
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  if (existing.author_email !== callerEmail)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

// PATCH /api/memories   body: { id, content?, caption? }
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const auth  = request.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/, '');

    const callerEmail = await getCallerEmail(request);
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = makeClient(token);

    const denied = await denyUnlessOwner(db, id, callerEmail);
    if (denied) return denied;

    const { data, error } = await db
      .from('memories').update(updates)
      .eq('id', id).eq('author_email', callerEmail)
      .select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: BLOCKED }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/memories?id=xxx
export async function DELETE(request) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const auth  = request.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/, '');

    const callerEmail = await getCallerEmail(request);
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = makeClient(token);

    const denied = await denyUnlessOwner(db, id, callerEmail);
    if (denied) return denied;

    // `select()` is what makes the deletion verifiable — an empty result means the
    // row is still there, so report that instead of a phantom success the client
    // would act on by dropping the card from the wall.
    const { data, error } = await db
      .from('memories').delete()
      .eq('id', id).eq('author_email', callerEmail)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0)
      return NextResponse.json({ error: BLOCKED }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
