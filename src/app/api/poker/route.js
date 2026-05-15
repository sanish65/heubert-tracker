import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET  /api/poker?sessionId=xxx   → fetch session + votes
// POST /api/poker                 → create session or cast vote
// PATCH /api/poker                → update session (reveal / reset)

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const { data: session, error: sErr } = await supabase
    .from('poker_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: votes, error: vErr } = await supabase
    .from('poker_votes')
    .select('*')
    .eq('session_id', sessionId);

  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  return NextResponse.json({ session, votes: votes || [] });
}

export async function POST(request) {
  const body = await request.json();

  // Create new session
  if (body.action === 'create') {
    const { title, createdBy } = body;
    const { data, error } = await supabase
      .from('poker_sessions')
      .insert({ title, created_by: createdBy, revealed: false })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  // Cast or update a vote
  if (body.action === 'vote') {
    const { sessionId, participantName, vote } = body;

    // upsert by session_id + participant_name
    const { data, error } = await supabase
      .from('poker_votes')
      .upsert(
        { session_id: sessionId, participant_name: participantName, vote },
        { onConflict: 'session_id,participant_name' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vote: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function PATCH(request) {
  const body = await request.json();
  const { sessionId, action } = body;

  if (action === 'reveal') {
    const { data, error } = await supabase
      .from('poker_sessions')
      .update({ revealed: true })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  if (action === 'reset') {
    // Delete all votes, un-reveal
    await supabase.from('poker_votes').delete().eq('session_id', sessionId);
    const { data, error } = await supabase
      .from('poker_sessions')
      .update({ revealed: false })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
