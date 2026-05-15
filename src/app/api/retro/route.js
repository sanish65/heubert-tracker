import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET  /api/retro?sessionId=xxx  → fetch session + cards
// POST /api/retro               → create session | add card
// DELETE /api/retro             → delete a card

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const { data: session, error: sErr } = await supabase
    .from('retro_sessions').select('*').eq('id', sessionId).single();
  if (sErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { data: cards, error: cErr } = await supabase
    .from('retro_cards').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  return NextResponse.json({ session, cards: cards || [] });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === 'create') {
    const { title, createdBy } = body;
    const { data, error } = await supabase
      .from('retro_sessions').insert({ title, created_by: createdBy }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  if (body.action === 'add_card') {
    const { sessionId, columnType, content, author } = body;
    const { data, error } = await supabase
      .from('retro_cards')
      .insert({ session_id: sessionId, column_type: columnType, content, author })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ card: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

  const { error } = await supabase.from('retro_cards').delete().eq('id', cardId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
