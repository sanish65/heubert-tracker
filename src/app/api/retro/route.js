import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { selectBoardActionItems } from '@/lib/retroBoardRules';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET  /api/retro?sessionId=xxx  → fetch session + cards + card reactions
// POST /api/retro               → create session | add card | react_card | unreact_card
// DELETE /api/retro             → delete a card

// `template` and `project_id` were both added to retro_sessions after boards already
// existed (see scripts/retro-projects-schema.sql). Until that migration is applied the
// insert is rejected outright rather than ignored, so a create must be able to retry
// without the column the database is missing — losing the association is bad, losing
// the whole board is worse.
function missingColumn(message = '') {
  const match =
    message.match(/column "?([a-z_]+)"? .*does not exist/i) ||
    message.match(/Could not find the '([a-z_]+)' column/i);
  return match ? match[1] : null;
}

// retro_action_items, retro_kudos and retro_kudos_reactions come from
// scripts/retro-action-items-kudos-schema.sql, applied by hand. Until then reads fail
// with a missing-relation error, which must not take the board down with it.
function missingTable(message = '') {
  return /relation "?[a-z_.]+"? does not exist/i.test(message) || /Could not find the table/i.test(message);
}

// Everything the board shows beyond cards: action items (carried from earlier boards of
// the project plus this board's own), the project's members, kudos and their reactions.
// Every read here degrades to an empty list on error — these are extras, and a board that
// can load its cards must never 500 because of them. The independent reads run together
// because every viewer polls this route every 2.5 s.
async function loadBoardExtras(session) {
  const hasProject = session.project_id != null;
  let warnedMissing = false;

  const safe = async (query) => {
    const { data, error } = await query;
    if (!error) return data || [];
    if (missingTable(error.message)) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn('Retro action items / kudos tables are missing — apply scripts/retro-action-items-kudos-schema.sql.');
      }
    } else {
      console.warn('Retro board extras read failed:', error.message);
    }
    return [];
  };

  const [projectBoardRows, memberRows, kudosRows, reactionRows] = await Promise.all([
    hasProject
      ? safe(supabase.from('retro_sessions').select('id,title,created_at').eq('project_id', session.project_id))
      : [],
    hasProject
      ? safe(supabase.from('project_members').select('employee_id').eq('project_id', session.project_id))
      : [],
    safe(supabase.from('retro_kudos').select('*').eq('session_id', session.id).order('created_at', { ascending: true })),
    safe(supabase.from('retro_kudos_reactions').select('kudos_id, participant_name, emoji').eq('session_id', session.id)),
  ]);

  const projectBoards = projectBoardRows.map((b) => ({
    ...b,
    title: (b.title || '').replace(/\s\[(\w+)\]$/, ''),
  }));

  const boardIds = [...new Set([session.id, ...projectBoards.map((b) => b.id)])];
  const itemRows = await safe(supabase.from('retro_action_items').select('*').in('session_id', boardIds));

  const { carried, own } = selectBoardActionItems({ board: session, projectBoards, items: itemRows });

  const employeeIds = [
    ...new Set([
      ...memberRows.map((m) => m.employee_id),
      ...carried.map((i) => i.owner_employee_id),
      ...own.map((i) => i.owner_employee_id),
      ...kudosRows.flatMap((k) => k.tagged_employee_ids || []),
    ].filter((id) => id != null)),
  ];

  const names = new Map();
  if (employeeIds.length) {
    const { data: employees, error } = await supabase.from('employees').select('id,name').in('id', employeeIds);
    if (error) console.warn('Retro board extras: employee names unavailable:', error.message);
    (employees || []).forEach((e) => names.set(e.id, e.name));
  }

  const withOwner = (i) => ({ ...i, owner_name: names.get(i.owner_employee_id) ?? null });

  const members = memberRows
    .filter((m) => names.has(m.employee_id))
    .map((m) => ({ id: m.employee_id, name: names.get(m.employee_id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    actionItems: { carried: carried.map(withOwner), own: own.map(withOwner) },
    members,
    kudos: kudosRows.map((k) => ({
      ...k,
      tagged_names: (k.tagged_employee_ids || []).map((id) => names.get(id)).filter(Boolean),
    })),
    kudosReactions: reactionRows,
  };
}

// Boards created before the project picker have no project_id; the UI shows them as
// unassigned. Resolving the name here keeps the public share page — which has no app
// context to look projects up in — able to show which project a board belongs to.
async function attachProjects(sessions) {
  const ids = [...new Set(sessions.map((s) => s.project_id).filter(Boolean))];
  if (!ids.length) return sessions.map((s) => ({ ...s, project_id: s.project_id ?? null, project: null }));

  const { data: projects } = await supabase.from('projects').select('id,name').in('id', ids);
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  return sessions.map((s) => ({
    ...s,
    project_id: s.project_id ?? null,
    project: byId.get(s.project_id) || null,
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    // List recent sessions. The limit covers every project's history at once, since the
    // home screen groups these by project — 10 would only ever show the busiest team.
    const { data: sessions, error: listErr } = await supabase
      .from('retro_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);

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

    return NextResponse.json({ sessions: await attachProjects(cleaned) });
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

  const { data: cardReactions } = await supabase
    .from('retro_card_reactions').select('card_id, participant_name, emoji').eq('session_id', sessionId);

  // Map DB column types back to the template keys if restricted by constraints
  // ORDER IS LOAD-BEARING: each template's keys map onto DB_COLS by position, because
  // retro_cards.column_type is constrained to the three standard values. The board shows
  // the standard columns in a different order (focus, improve, went_well) — that is
  // display only. Reordering the arrays here would file Focus cards as went_well.
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

  const [sessionWithProject] = await attachProjects([session]);
  const extras = await loadBoardExtras(session);

  return NextResponse.json({
    session: { ...sessionWithProject, is_ended: isEnded },
    cards: actualCards,
    cardReactions: cardReactions || [],
    activity,
    timerState,
    ...extras
  });
}

export async function POST(request) {
  const body = await request.json();

  if (body.action === 'create') {
    const { title, createdBy, template = 'standard', projectId = null } = body;

    // Retry without whichever optional column the database is missing, rather than
    // failing the create. `template` has a title-encoded fallback; `project_id` has
    // none, so a board created before the migration lands stays unassigned and shows
    // up under "No project" for someone to file.
    const payload = {
      title,
      created_by: createdBy,
      template,
      project_id: projectId ? Number(projectId) : null,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from('retro_sessions').insert(payload).select().single();

      if (!error) {
        const [session] = await attachProjects([{ ...data, title, template }]);
        return NextResponse.json({ session });
      }

      const missing = missingColumn(error.message);
      if (missing === 'template') {
        payload.title = `${title} [${template}]`;
        delete payload.template;
        continue;
      }
      if (missing === 'project_id') {
        console.warn('retro_sessions.project_id is missing — apply scripts/retro-projects-schema.sql. Board created unassigned.');
        delete payload.project_id;
        continue;
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Could not create the board.' }, { status: 500 });
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

    // ORDER IS LOAD-BEARING: each template's keys map onto DB_COLS by position, because
    // retro_cards.column_type is constrained to the three standard values. The board shows
    // the standard columns in a different order (focus, improve, went_well) — that is
    // display only. Reordering the arrays here would file Focus cards as went_well.
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

  if (body.action === 'react_card') {
    const { cardId, sessionId, participantName, emoji } = body;
    if (!cardId || !sessionId || !participantName || !emoji) {
      return NextResponse.json({ error: 'cardId, sessionId, participantName and emoji required' }, { status: 400 });
    }
    const { error } = await supabase
      .from('retro_card_reactions')
      .upsert(
        { card_id: cardId, session_id: sessionId, participant_name: participantName, emoji },
        { onConflict: 'card_id,participant_name,emoji' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'unreact_card') {
    const { cardId, participantName, emoji } = body;
    const { error } = await supabase
      .from('retro_card_reactions')
      .delete()
      .eq('card_id', cardId)
      .eq('participant_name', participantName)
      .eq('emoji', emoji);
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
      // ORDER IS LOAD-BEARING: each template's keys map onto DB_COLS by position, because
      // retro_cards.column_type is constrained to the three standard values. The board shows
      // the standard columns in a different order (focus, improve, went_well) — that is
      // display only. Reordering the arrays here would file Focus cards as went_well.
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
      
      // 1. Fetch current card and its reactions to prepare for "edit via replace"
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

      // 2. Fetch reactions to preserve them
      const { data: reactions, error: reactionsErr } = await supabase.from('retro_card_reactions').select('*').eq('card_id', cardId);
      if (reactionsErr) {
        return NextResponse.json({ error: 'Failed to backup reactions: ' + reactionsErr.message }, { status: 500 });
      }

      // 3. Delete the old card (cascades to reactions)
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

      // 5. Restore reactions
      if (reactions && reactions.length > 0) {
        const reactionsToInsert = reactions.map(r => ({
          session_id: r.session_id,
          card_id: r.card_id,
          participant_name: r.participant_name,
          emoji: r.emoji,
          created_at: r.created_at
        }));
        await supabase.from('retro_card_reactions').insert(reactionsToInsert);
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
