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

    // Verify ownership
    const { data: existing, error: fetchErr } = await db
      .from('memories').select('id, author_email').eq('id', id).single();

    if (fetchErr)
      return NextResponse.json({ error: `DB error: ${fetchErr.message}` }, { status: 500 });
    if (!existing)
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    if (existing.author_email !== callerEmail)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await db
      .from('memories').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

    // Verify ownership
    const { data: existing, error: fetchErr } = await db
      .from('memories').select('id, author_email').eq('id', id).single();

    if (fetchErr)
      return NextResponse.json({ error: `DB error: ${fetchErr.message}` }, { status: 500 });
    if (!existing)
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    if (existing.author_email !== callerEmail)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await db.from('memories').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
