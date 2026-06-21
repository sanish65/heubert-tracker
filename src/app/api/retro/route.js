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
  
  if (!sessionId) {
    // List recent sessions
    const { data: sessions, error: listErr } = await supabase
      .from('retro_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    
    // Check which of these are ended
    const sids = sessions.map(s => s.id);
    const { data: endedSignals } = await supabase
      .from('retro_cards')
      .select('session_id')
      .eq('content', '__SESSION_ENDED__')
      .in('session_id', sids);
    
    const endedSids = new Set(endedSignals?.map(es => es.session_id) || []);

    // Clean templates and titles for each session
    const cleaned = sessions.map(s => {
      let templ = s.template;
      let title = s.title;
      if (!templ) {
        const match = title.match(/\s\[(\w+)\]$/);
        if (match) {
          templ = match[1];
          title = title.replace(match[0], '');
        } else {
          templ = 'standard';
        }
      }
      return { ...s, template: templ, title, is_ended: endedSids.has(s.id) };
    });

    return NextResponse.json({ sessions: cleaned });
  }

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
  let timerState = null;
  
  let isEnded = false;
  (cards || []).forEach(c => {
    if (c.content === '__SESSION_ENDED__') {
      isEnded = true;
    } else if (c.author === 'SYSTEM:TIMER') {
      try {
        timerState = JSON.parse(c.content);
      } catch (e) {
        // ignore malformed timer state
      }
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
    activity,
    timerState
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

  if (body.action === 'edit_card') {
    try {
      const { cardId, content, author } = body;
      
      if (!cardId || !content?.trim()) return NextResponse.json({ error: 'cardId and content required' }, { status: 400 });
      
      // 1. Fetch current card and its votes to prepare for "edit via replace"
      const { data: card, error: fetchErr } = await supabase.from('retro_cards').select('*').eq('id', cardId).single();
      if (fetchErr) {
        return NextResponse.json({ error: 'Card fetch failed: ' + fetchErr.message }, { status: 500 });
      }
      if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
      
      const cardAuthor = (card.author || "").toLowerCase().trim();
      const reqAuthor = (author || "").toLowerCase().trim();
      const isOwner = cardAuthor === reqAuthor;
      
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden: You can only edit your own cards' }, { status: 403 });
      }

      // 2. Fetch votes to preserve them
      const { data: votes, error: votesErr } = await supabase.from('retro_card_votes').select('*').eq('card_id', cardId);
      if (votesErr) {
        return NextResponse.json({ error: 'Failed to backup votes: ' + votesErr.message }, { status: 500 });
      }

      // 3. Delete the old card (cascades to votes)
      const { error: delErr } = await supabase.from('retro_cards').delete().eq('id', cardId);
      if (delErr) {
        return NextResponse.json({ error: 'Failed to prepare edit: ' + delErr.message }, { status: 500 });
      }

      // 4. Re-insert the card with the SAME ID but updated content
      const { data: newData, error: insertErr } = await supabase.from('retro_cards').insert({
        id: card.id,
        session_id: card.session_id,
        column_type: card.column_type,
        content: content.trim(),
        author: card.author,
        created_at: card.created_at // Preserve original timestamp
      }).select().single();

      if (insertErr) {
        return NextResponse.json({ error: 'Failed to re-insert card: ' + insertErr.message }, { status: 500 });
      }

      // 5. Restore votes
      if (votes && votes.length > 0) {
        // Clean votes slightly (remove internal Supabase ID if present requested by PK)
        const votesToInsert = votes.map(v => ({
          session_id: v.session_id,
          card_id: v.card_id,
          participant_name: v.participant_name,
          created_at: v.created_at
        }));
        const { error: restoreVotesErr } = await supabase.from('retro_card_votes').insert(votesToInsert);
        if (restoreVotesErr) {
          // Note: The card is already updated, so we might want to warn rather than fail completely,
          // but for consistency we'll report the error.
        }
      }
      
      return NextResponse.json({ card: newData });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (body.action === 'upsert_timer') {
    const { sessionId, timerState } = body;
    if (!sessionId || !timerState) return NextResponse.json({ error: 'sessionId and timerState required' }, { status: 400 });

    // Check if timer card already exists
    const { data: timerCard } = await supabase.from('retro_cards').select('id').eq('session_id', sessionId).eq('author', 'SYSTEM:TIMER').maybeSingle();

    if (timerCard) {
      const { error } = await supabase.from('retro_cards').update({ content: JSON.stringify(timerState) }).eq('id', timerCard.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from('retro_cards').insert({
        session_id: sessionId,
        column_type: 'went_well',
        content: JSON.stringify(timerState),
        author: 'SYSTEM:TIMER'
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
