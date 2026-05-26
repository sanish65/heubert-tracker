import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET  /api/retro?sessionId=xxx  → fetch session + cards + card votes
// POST /api/retro               → create session | add card | vote_card | unvote_card
// DELETE /api/retro             → delete a card

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const { data: session, error: sErr } = await supabase
    .from('retro_sessions').select('*').eq('id', sessionId).single();
  if (sErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Handle template fallback if column is missing or encoded in title
  let activeTemplate = session.template;
  if (!activeTemplate) {
    const match = session.title.match(/\s\[(\w+)\]$/);
    if (match) {
      activeTemplate = match[1];
      session.template = activeTemplate;
      session.title = session.title.replace(match[0], '');
    } else {
      activeTemplate = 'standard';
      session.template = activeTemplate;
    }
  }

  const { data: cards, error: cErr } = await supabase
    .from('retro_cards').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const { data: cardVotes } = await supabase
    .from('retro_card_votes').select('card_id, participant_name').eq('session_id', sessionId);

  // Map DB column types back to the template keys if restricted by constraints
  const TEMPLATES = {
    standard: ['went_well', 'improve', 'focus'],
    sailboat: ['wind', 'anchors', 'rocks'],
    start_stop: ['start', 'stop', 'continue']
  };
  const DB_COLS = ['went_well', 'improve', 'focus'];
  const sessionCols = TEMPLATES[activeTemplate] || TEMPLATES.standard;

  const activity = [];
  const actualCards = [];
  
  let isEnded = false;
  (cards || []).forEach(c => {
    if (c.content === '__SESSION_ENDED__') {
      isEnded = true;
    } else if (c.content === '__THINKING__') {
      const idx = DB_COLS.indexOf(c.column_type);
      const uiCol = idx >= 0 ? sessionCols[idx] : c.column_type;
      activity.push({ ...c, column_type: uiCol, participant_name: c.author.replace('TYPING:', '') });
    } else {
      const idx = DB_COLS.indexOf(c.column_type);
      const uiCol = idx >= 0 ? sessionCols[idx] : c.column_type;
      actualCards.push({ ...c, column_type: uiCol });
    }
  });

  return NextResponse.json({ 
    session: { ...session, is_ended: isEnded }, 
    cards: actualCards, 
    cardVotes: cardVotes || [], 
    activity 
  });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === 'create') {
    const { title, createdBy, template = 'standard' } = body;
    const { data, error } = await supabase
      .from('retro_sessions').insert({ title, created_by: createdBy, template }).select().single();
    if (error) {
      // Fallback if template column doesn't exist or is not in schema cache
      if (error.message.includes('column "template" does not exist') || error.message.includes('Could not find the \'template\' column')) {
        const encodedTitle = `${title} [${template}]`;
        const { data: retryData, error: retryError } = await supabase
          .from('retro_sessions').insert({ title: encodedTitle, created_by: createdBy }).select().single();
        if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 });
        
        // Clean the title for the response
        retryData.title = title;
        retryData.template = template;
        return NextResponse.json({ session: retryData });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ session: data });
  }

  if (body.action === 'add_card') {
    const { sessionId, columnType, content, author } = body;
    
    // Fallback: translate columnType to DB compatible one based on session template
    const { data: session } = await supabase.from('retro_sessions').select('*').eq('id', sessionId).single();
    let template = session?.template;
    if (!template && session?.title) {
        const match = session.title.match(/\s\[(\w+)\]$/);
        if (match) template = match[1];
    }
    template = template || 'standard';

    const TEMPLATES = {
      standard: ['went_well', 'improve', 'focus'],
      sailboat: ['wind', 'anchors', 'rocks'],
      start_stop: ['start', 'stop', 'continue']
    };
    const DB_COLS = ['went_well', 'improve', 'focus'];
    const sessionCols = TEMPLATES[template] || TEMPLATES.standard;
    const colIdx = sessionCols.indexOf(columnType);
    const dbColumnType = colIdx >= 0 ? DB_COLS[colIdx] : columnType;

    const { data, error } = await supabase
      .from('retro_cards')
      .insert({ session_id: sessionId, column_type: dbColumnType, content, author })
      .select().single();
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Map back for the immediate response
    data.column_type = columnType;
    return NextResponse.json({ card: data });
  }

  if (body.action === 'vote_card') {
    const { cardId, sessionId, participantName } = body;
    const { error } = await supabase
      .from('retro_card_votes')
      .upsert(
        { card_id: cardId, session_id: sessionId, participant_name: participantName },
        { onConflict: 'card_id,participant_name' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'unvote_card') {
    const { cardId, participantName } = body;
    const { error } = await supabase
      .from('retro_card_votes')
      .delete()
      .eq('card_id', cardId)
      .eq('participant_name', participantName);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'sync_activity') {
    const { sessionId, participantName, columnType, isTyping } = body;
    if (!isTyping) {
      await supabase.from('retro_cards').delete()
        .eq('session_id', sessionId)
        .eq('author', `TYPING:${participantName}`);
    } else {
      // Map columnType to DB type
      const { data: session } = await supabase.from('retro_sessions').select('*').eq('id', sessionId).single();
      let template = session?.template || 'standard';
      if (!session?.template && session?.title) {
        const match = session.title.match(/\s\[(\w+)\]$/);
        if (match) template = match[1];
      }
      const TEMPLATES = { standard: ['went_well', 'improve', 'focus'], sailboat: ['wind', 'anchors', 'rocks'], start_stop: ['start', 'stop', 'continue'] };
      const DB_COLS = ['went_well', 'improve', 'focus'];
      const sessionCols = TEMPLATES[template] || TEMPLATES.standard;
      const colIdx = sessionCols.indexOf(columnType);
      const dbColumnType = colIdx >= 0 ? DB_COLS[colIdx] : columnType;

      // Clean up previous activity from this user
      await supabase.from('retro_cards').delete()
        .eq('session_id', sessionId)
        .eq('author', `TYPING:${participantName}`);

      // Insert new activity
      await supabase.from('retro_cards').insert({
        session_id: sessionId,
        column_type: dbColumnType,
        content: '__THINKING__',
        author: `TYPING:${participantName}`
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'end_session') {
    const { sessionId } = body;
    // Insert a system card to signal end of session
    const { error } = await supabase.from('retro_cards').insert({
      session_id: sessionId,
      column_type: 'went_well',
      content: '__SESSION_ENDED__',
      author: 'SYSTEM'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
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
