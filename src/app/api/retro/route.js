import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  ACTION_ITEM_MAX,
  KUDOS_MAX,
  canChangeActionItem,
  canChangeKudos,
  isFacilitator,
  selectBoardActionItems,
} from '@/lib/retroBoardRules';
import { THEME_NAME_MAX, canChangeThemes, checkThemes, cleanThemeName } from '@/lib/retroThemes';

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

// The board a write is aimed at, plus whether it has ended (a retro_cards row with the
// __SESSION_ENDED__ signal — the same signal GET uses). session is null when not found.
async function loadBoard(sessionId) {
  const { data: session } = await supabase
    .from('retro_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session) return { session: null, isEnded: false };

  const { data: signals } = await supabase
    .from('retro_cards').select('id')
    .eq('session_id', sessionId).eq('content', '__SESSION_ENDED__').limit(1);
  return { session, isEnded: (signals || []).length > 0 };
}

// employee_id of everyone on a project; empty when the board has no project.
async function projectMemberIds(projectId) {
  if (projectId == null) return [];
  const { data } = await supabase.from('project_members').select('employee_id').eq('project_id', projectId);
  return (data || []).map((m) => m.employee_id);
}

// ilike treats % and _ as wildcards and \ as the escape; an email is a literal.
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// Admin comes only from a verified bearer token mapped to an employee row, never from the
// request body. No token, a bad token, or an unknown email all mean "not an admin".
async function callerIsAdmin(request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return false;

  const pattern = escapeLike(email);
  const [work, personal] = await Promise.all([
    supabase.from('employees').select('is_admin').ilike('work_email', pattern),
    supabase.from('employees').select('is_admin').ilike('personal_email', pattern),
  ]);
  return [...(work.data || []), ...(personal.data || [])].some((e) => e.is_admin === true);
}

const fail = (error, status) => NextResponse.json({ error }, { status });
const MISSING_ACTION_TABLE = 'Action items need scripts/retro-action-items-kudos-schema.sql applied.';
const MISSING_SOURCE_CARD_COLUMN = 'Ticking voted cards needs scripts/retro-voted-action-items.sql applied.';
// PostgREST names the column table-qualified ("retro_action_items.source_card_id does not
// exist") or as a schema-cache miss, neither of which missingColumn's patterns catch.
const missingSourceCardColumn = (message = '') =>
  /source_card_id/.test(message) && /does not exist|Could not find/i.test(message);

// An item is on a board when it was added there, or on an earlier board of the same
// project (that is what "carried" means). Without this a facilitator of one project could
// edit another project's items by id.
async function itemIsOnBoard(item, session) {
  if (item.session_id === session.id) return true;
  if (session.project_id == null) return false;
  const { data: origin } = await supabase
    .from('retro_sessions').select('project_id,created_at').eq('id', item.session_id).maybeSingle();
  return !!origin
    && origin.project_id === session.project_id
    && Date.parse(origin.created_at) < Date.parse(session.created_at);
}

const ACTION_ITEM_OPS = {
  add_action_item: 'add',
  update_action_item: 'edit',
  set_action_item_done: 'tick',
  delete_action_item: 'delete',
};

async function handleActionItem(request, body) {
  const op = ACTION_ITEM_OPS[body.action];
  const { sessionId, itemId, actorName } = body;
  const writesContent = op === 'add' || op === 'edit';
  const needsItem = op !== 'add';

  // 1. Shape
  if (typeof sessionId !== 'string' || !sessionId || typeof actorName !== 'string' || !actorName.trim()) {
    return fail('sessionId and actorName required', 400);
  }
  if (needsItem && (typeof itemId !== 'string' || !itemId)) return fail('itemId required', 400);
  let content;
  let ownerEmployeeId = null;
  if (writesContent) {
    content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > ACTION_ITEM_MAX) {
      return fail(`content required, up to ${ACTION_ITEM_MAX} characters`, 400);
    }
    ownerEmployeeId = body.ownerEmployeeId ?? null;
    if (ownerEmployeeId !== null && !Number.isInteger(ownerEmployeeId)) {
      return fail('ownerEmployeeId must be a number or null', 400);
    }
  }
  if (op === 'tick' && typeof body.done !== 'boolean') return fail('done must be true or false', 400);
  // A card the facilitator ticked in the Top Voted view. Optional: hand-written items have none.
  const sourceCardId = op === 'add' ? (body.sourceCardId ?? null) : null;
  if (sourceCardId !== null && (typeof sourceCardId !== 'string' || !sourceCardId)) {
    return fail('sourceCardId must be a card id or null', 400);
  }

  // 2. Board
  const { session, isEnded } = await loadBoard(sessionId);
  if (!session) return fail('Session not found', 404);

  // 3. Facilitator or admin
  const facilitator = isFacilitator(session, actorName);
  const isAdmin = facilitator ? false : await callerIsAdmin(request);
  if (!facilitator && !isAdmin) return fail('Only the facilitator or an admin can change action items.', 403);

  // 4. Ended board
  if (!canChangeActionItem({ op, isEnded, isFacilitator: facilitator, isAdmin })) {
    return fail('This retro has ended — action items can only be ticked.', 409);
  }

  // 5. Item exists and belongs to this board's project history
  if (needsItem) {
    const { data: item, error } = await supabase
      .from('retro_action_items').select('id,session_id').eq('id', itemId).maybeSingle();
    if (error) {
      if (missingTable(error.message)) return fail(MISSING_ACTION_TABLE, 503);
      console.warn('Retro action item lookup failed:', error.message);
      return fail('Could not load the action item.', 500);
    }
    if (!item) return fail('Action item not found', 404);
    if (!(await itemIsOnBoard(item, session))) return fail('That action item belongs to another board.', 403);
  }

  // 6. Owner must be on the board's project
  if (writesContent && ownerEmployeeId !== null) {
    const memberIds = await projectMemberIds(session.project_id);
    if (!memberIds.includes(ownerEmployeeId)) return fail("Owner must be a member of this board's project.", 400);
  }

  // 7. A voted card becomes an action item at most once, and only from its own board.
  if (sourceCardId !== null) {
    const { data: card } = await supabase
      .from('retro_cards').select('id,session_id').eq('id', sourceCardId).maybeSingle();
    if (!card || card.session_id !== sessionId) return fail('That card is not on this board.', 404);

    const { data: existing, error } = await supabase
      .from('retro_action_items').select('*').eq('source_card_id', sourceCardId).maybeSingle();
    if (error) {
      if (missingTable(error.message) || missingSourceCardColumn(error.message)) {
        return fail(MISSING_SOURCE_CARD_COLUMN, 503);
      }
      console.warn('Retro action item lookup failed:', error.message);
      return fail('Could not save the action item.', 500);
    }
    if (existing) return NextResponse.json({ item: existing });
  }

  let query;
  if (op === 'add') {
    const row = { session_id: sessionId, content, owner_employee_id: ownerEmployeeId, created_by: actorName.trim() };
    if (sourceCardId !== null) row.source_card_id = sourceCardId;
    query = supabase.from('retro_action_items').insert(row).select().single();
  } else if (op === 'edit') {
    query = supabase.from('retro_action_items')
      .update({ content, owner_employee_id: ownerEmployeeId }).eq('id', itemId).select().single();
  } else if (op === 'tick') {
    const stamp = body.done
      ? { done_at: new Date().toISOString(), done_by: actorName.trim() }
      : { done_at: null, done_by: null };
    query = supabase.from('retro_action_items').update(stamp).eq('id', itemId).select().single();
  } else {
    query = supabase.from('retro_action_items').delete().eq('id', itemId);
  }

  const { data, error } = await query;
  if (error) {
    if (missingTable(error.message)) return fail(MISSING_ACTION_TABLE, 503);
    if (missingSourceCardColumn(error.message)) return fail(MISSING_SOURCE_CARD_COLUMN, 503);
    // Two clicks racing on the same card: the unique index lets one through; hand the
    // loser the item that won rather than an error.
    if (sourceCardId !== null && error.code === '23505') {
      const { data: winner } = await supabase
        .from('retro_action_items').select('*').eq('source_card_id', sourceCardId).maybeSingle();
      if (winner) return NextResponse.json({ item: winner });
    }
    console.warn('Retro action item write failed:', error.message);
    return fail('Could not save the action item.', 500);
  }
  return NextResponse.json(op === 'delete' ? { ok: true } : { item: data });
}

const MISSING_KUDOS_TABLE = 'Kudos need scripts/retro-action-items-kudos-schema.sql applied.';

const KUDOS_OPS = {
  add_kudos: 'add',
  edit_kudos: 'edit',
  delete_kudos: 'delete',
  react_kudos: 'react',
  unreact_kudos: 'unreact',
};

async function handleKudos(body) {
  const kind = KUDOS_OPS[body.action];
  // unreact is a react-side write as far as the rules are concerned.
  const op = kind === 'unreact' ? 'react' : kind;
  const { sessionId, kudosId, actorName } = body;
  const writesContent = kind === 'add' || kind === 'edit';
  const needsKudos = kind !== 'add';
  const isReaction = kind === 'react' || kind === 'unreact';

  // 1. Shape
  if (typeof sessionId !== 'string' || !sessionId || typeof actorName !== 'string' || !actorName.trim()) {
    return fail('sessionId and actorName required', 400);
  }
  if (needsKudos && (typeof kudosId !== 'string' || !kudosId)) return fail('kudosId required', 400);
  let content;
  let taggedIds = [];
  if (writesContent) {
    content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > KUDOS_MAX) {
      return fail(`content required, up to ${KUDOS_MAX} characters`, 400);
    }
    const tagged = body.taggedEmployeeIds ?? [];
    if (!Array.isArray(tagged) || !tagged.every(Number.isInteger)) {
      return fail('taggedEmployeeIds must be a list of numbers', 400);
    }
    taggedIds = [...new Set(tagged)];
  }
  const emoji = body.emoji;
  if (isReaction && (typeof emoji !== 'string' || !emoji || emoji.length > 32)) {
    return fail('emoji required', 400);
  }

  // 2. Board, then the kudos on it
  const { session, isEnded } = await loadBoard(sessionId);
  if (!session) return fail('Session not found', 404);

  let kudos = null;
  if (needsKudos) {
    const { data, error } = await supabase
      .from('retro_kudos').select('id,session_id,author').eq('id', kudosId).maybeSingle();
    if (error) {
      if (missingTable(error.message)) return fail(MISSING_KUDOS_TABLE, 503);
      console.warn('Retro kudos lookup failed:', error.message);
      return fail('Could not load the kudos.', 500);
    }
    if (!data || data.session_id !== sessionId) return fail('Kudos not found', 404);
    kudos = data;
  }

  // 3. Ended board
  if (isEnded) return fail('This retro has ended.', 409);

  // 4. Permission. Admins get no extra kudos rights.
  if (!canChangeKudos({ op, isEnded, kudos, actorName, isFacilitator: isFacilitator(session, actorName) })) {
    return fail('You cannot do that to this kudos.', 403);
  }

  // 5. Tagged people must be on the board's project (none when it has no project)
  if (writesContent && taggedIds.length) {
    const memberIds = await projectMemberIds(session.project_id);
    if (!taggedIds.every((id) => memberIds.includes(id))) {
      return fail("Tagged people must be members of this board's project.", 400);
    }
  }

  const name = actorName.trim();
  let query;
  if (kind === 'add') {
    query = supabase.from('retro_kudos')
      .insert({ session_id: sessionId, content, author: name, tagged_employee_ids: taggedIds })
      .select().single();
  } else if (kind === 'edit') {
    query = supabase.from('retro_kudos')
      .update({ content, tagged_employee_ids: taggedIds }).eq('id', kudosId).select().single();
  } else if (kind === 'delete') {
    query = supabase.from('retro_kudos').delete().eq('id', kudosId);
  } else if (kind === 'react') {
    query = supabase.from('retro_kudos_reactions').upsert(
      { kudos_id: kudosId, session_id: sessionId, participant_name: name, emoji },
      { onConflict: 'kudos_id,participant_name,emoji' }
    );
  } else {
    query = supabase.from('retro_kudos_reactions').delete()
      .eq('kudos_id', kudosId).eq('participant_name', name).eq('emoji', emoji);
  }

  const { data, error } = await query;
  if (error) {
    if (missingTable(error.message)) return fail(MISSING_KUDOS_TABLE, 503);
    console.warn('Retro kudos write failed:', error.message);
    return fail('Could not save the kudos.', 500);
  }
  return NextResponse.json(writesContent ? { kudos: data } : { ok: true });
}

const MISSING_THEME_TABLE = 'Themes need scripts/retro-card-themes-schema.sql applied.';

const THEME_OPS = {
  group_cards: 'group',
  create_theme: 'create',
  move_card_to_theme: 'move',
  rename_theme: 'rename',
  ungroup_cards: 'ungroup',
};

// Card and theme ids are uuids; anything else would make Postgres reject the query with
// a 500 instead of the 400 a malformed request deserves.
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// The board's real cards: system rows (end signal, typing activity, timer) are not cards.
const boardCardsQuery = (sessionId) => supabase
  .from('retro_cards').select('id,column_type').eq('session_id', sessionId)
  .neq('content', '__SESSION_ENDED__').neq('content', '__THINKING__').neq('author', 'SYSTEM:TIMER');

const themeWriteFailed = (error) => {
  if (missingTable(error.message)) return fail(MISSING_THEME_TABLE, 503);
  console.warn('Retro theme write failed:', error.message);
  return fail('Could not save the themes.', 500);
};

// A theme younger than this is never pruned: another request may have inserted it and
// not yet written its card links (create_theme, group_cards), and pruning it then would
// make that request's link write fail. The boards hide themes with no present cards
// anyway, so a theme left behind for a minute shows nothing and goes on a later prune.
const PRUNE_GRACE_MS = 60_000;

// Housekeeping after a move or split: drop the board's themes no card links to any more
// (AC 11). Two reads and at most one delete, whatever the number of themes.
async function pruneEmptyThemes(sessionId) {
  const cutoff = new Date(Date.now() - PRUNE_GRACE_MS).toISOString();
  const [themes, links] = await Promise.all([
    supabase.from('retro_themes').select('id').eq('session_id', sessionId).lt('created_at', cutoff),
    supabase.from('retro_theme_cards').select('theme_id').eq('session_id', sessionId),
  ]);
  const readError = themes.error || links.error;
  if (readError) return readError;
  const linked = new Set((links.data || []).map((l) => l.theme_id));
  const empty = (themes.data || []).map((t) => t.id).filter((id) => !linked.has(id));
  if (!empty.length) return null;
  const { error } = await supabase.from('retro_themes').delete().eq('session_id', sessionId).in('id', empty);
  return error || null;
}

async function handleTheme(request, body) {
  const op = THEME_OPS[body.action];
  const { sessionId, actorName } = body;

  // 1. Shape
  if (typeof sessionId !== 'string' || !sessionId || typeof actorName !== 'string' || !actorName.trim()) {
    return fail('sessionId and actorName required', 400);
  }
  if (op === 'group' && !Array.isArray(body.themes)) return fail('themes required', 400);
  if (op === 'create' && !Array.isArray(body.cardIds)) return fail('cardIds required', 400);
  if (op === 'move' && !isUuid(body.cardId)) return fail('cardId required', 400);
  if ((op === 'move' || op === 'rename') && !isUuid(body.themeId)) return fail('themeId required', 400);
  let name = null;
  if (op === 'create' || op === 'rename') {
    name = cleanThemeName(body.name);
    if (!name) return fail(`Theme names are 1 to ${THEME_NAME_MAX} characters.`, 400);
  }

  // 2. Board
  const { session, isEnded } = await loadBoard(sessionId);
  if (!session) return fail('Session not found', 404);

  // 3. Facilitator or admin
  const facilitator = isFacilitator(session, actorName);
  const isAdmin = facilitator ? false : await callerIsAdmin(request);
  if (!facilitator && !isAdmin) return fail('Only the facilitator or an admin can change themes.', 403);

  // 4. Ended board
  if (!canChangeThemes({ isEnded, isFacilitator: facilitator, isAdmin })) {
    return fail('This retro has ended — themes can no longer change.', 409);
  }

  // 5. The cards and theme the request names must be on this board
  let checked = null;
  if (op === 'group' || op === 'create') {
    const { data: boardCards, error } = await boardCardsQuery(sessionId);
    if (error) return themeWriteFailed(error);
    const themes = op === 'group' ? body.themes : [{ name, cardIds: body.cardIds }];
    const result = checkThemes({ boardCards: boardCards || [], themes });
    if (result.error) return fail(result.error, 400);
    checked = result.themes;
  }

  if (op === 'move' || op === 'rename') {
    const { data: theme, error } = await supabase
      .from('retro_themes').select('id,column_type')
      .eq('id', body.themeId).eq('session_id', sessionId).maybeSingle();
    if (error) return themeWriteFailed(error);
    if (!theme) return fail('Theme not found', 404);

    if (op === 'move') {
      const { data: card, error: cardError } = await boardCardsQuery(sessionId).eq('id', body.cardId).maybeSingle();
      if (cardError) return themeWriteFailed(cardError);
      if (!card) return fail('That card is not on this board.', 404);
      if (card.column_type !== theme.column_type) return fail('A card can only move to a theme in its own column.', 400);
    }
  }

  // 6. Writes. Ids are made here so link rows can be built without relying on the order
  // of bulk-insert results.
  const createdBy = actorName.trim();
  const toRows = (themes) => {
    const themeRows = [];
    const linkRows = [];
    for (const t of themes) {
      const id = randomUUID();
      themeRows.push({ id, session_id: sessionId, column_type: t.column_type, name: t.name, created_by: createdBy });
      t.cardIds.forEach((cardId) => linkRows.push({ card_id: cardId, theme_id: id, session_id: sessionId }));
    }
    return { themeRows, linkRows };
  };

  if (op === 'group') {
    const { themeRows, linkRows } = toRows(checked);
    // Not a transaction: Supabase's client has none. If a later step fails the request
    // returns 500 and the next poll shows whatever landed (no themes, or themes with no
    // cards, which the boards hide); grouping again replaces it all.
    const cleared = await supabase.from('retro_themes').delete().eq('session_id', sessionId);
    if (cleared.error) return themeWriteFailed(cleared.error);
    const inserted = await supabase.from('retro_themes').insert(themeRows);
    if (inserted.error) return themeWriteFailed(inserted.error);
    const linked = await supabase.from('retro_theme_cards').insert(linkRows);
    if (linked.error) return themeWriteFailed(linked.error);
  } else if (op === 'create' || op === 'move') {
    let linkRows;
    if (op === 'create') {
      const rows = toRows(checked);
      const inserted = await supabase.from('retro_themes').insert(rows.themeRows);
      if (inserted.error) return themeWriteFailed(inserted.error);
      linkRows = rows.linkRows;
    } else {
      linkRows = [{ card_id: body.cardId, theme_id: body.themeId, session_id: sessionId }];
    }
    // Each card leaves whatever theme it was in: card_id is the key.
    const linked = await supabase.from('retro_theme_cards').upsert(linkRows, { onConflict: 'card_id' });
    if (linked.error) return themeWriteFailed(linked.error);
    // The change is saved; a failed prune only leaves an empty theme the boards hide.
    const pruneError = await pruneEmptyThemes(sessionId);
    if (pruneError) console.warn('Retro empty-theme prune failed:', pruneError.message);
  } else if (op === 'rename') {
    const { error } = await supabase
      .from('retro_themes').update({ name }).eq('id', body.themeId).eq('session_id', sessionId);
    if (error) return themeWriteFailed(error);
  } else {
    const { error } = await supabase.from('retro_themes').delete().eq('session_id', sessionId);
    if (error) return themeWriteFailed(error);
  }

  return NextResponse.json({ ok: true });
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
        console.warn('Retro board extras tables are missing — apply scripts/retro-action-items-kudos-schema.sql and scripts/retro-card-themes-schema.sql.');
      }
    } else {
      console.warn('Retro board extras read failed:', error.message);
    }
    return [];
  };

  const [projectBoardRows, memberRows, kudosRows, reactionRows, themes, themeCards] = await Promise.all([
    hasProject
      ? safe(supabase.from('retro_sessions').select('id,title,created_at').eq('project_id', session.project_id))
      : [],
    hasProject
      ? safe(supabase.from('project_members').select('employee_id').eq('project_id', session.project_id))
      : [],
    safe(supabase.from('retro_kudos').select('*').eq('session_id', session.id).order('created_at', { ascending: true })),
    safe(supabase.from('retro_kudos_reactions').select('kudos_id, participant_name, emoji').eq('session_id', session.id)),
    safe(supabase.from('retro_themes').select('id,name,created_at').eq('session_id', session.id)),
    safe(supabase.from('retro_theme_cards').select('card_id,theme_id').eq('session_id', session.id)),
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
    themes,
    themeCards,
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

  if (Object.hasOwn(ACTION_ITEM_OPS, body.action)) return handleActionItem(request, body);
  if (Object.hasOwn(KUDOS_OPS, body.action)) return handleKudos(body);
  if (Object.hasOwn(THEME_OPS, body.action)) return handleTheme(request, body);

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get('cardId');
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

  const { error } = await supabase.from('retro_cards').delete().eq('id', cardId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The theme link has no foreign key (edit_card re-inserts under the same id), so it goes
  // here. Its error is ignored: the table may not exist yet, and a stale link to a missing
  // card shows nothing.
  await supabase.from('retro_theme_cards').delete().eq('card_id', cardId);
  return NextResponse.json({ ok: true });
}
