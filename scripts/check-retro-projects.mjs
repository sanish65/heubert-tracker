// RETRO → PROJECT INTEGRITY CHECK  (read-only)
//   node scripts/check-retro-projects.mjs
//
// Run after applying scripts/retro-projects-schema.sql. Asserts two things:
//   1. Nothing was lost — the boards, cards and reactions that existed before the
//      migration are all still there (BASELINE below is the snapshot taken just
//      before it was written).
//   2. Every board names a project. A NULL project_id means a board is invisible
//      under every project filter in the UI, so it is reported as a failure.
//
// Requires Node 20+ (supabase-js needs a global fetch/Headers).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Snapshot taken 2026-08-28, before retro boards were scoped to projects.
const BASELINE = { sessions: 7, cards: 312, reactions: 138 };

const envFileContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const env = {};
envFileContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: projects, error: pErr } = await supabase.from('projects').select('id,name');
if (pErr) throw pErr;
const projectName = new Map(projects.map((p) => [p.id, p.name]));

const { data: sessions, error: sErr } = await supabase
  .from('retro_sessions')
  .select('*')
  .order('created_at', { ascending: true });
if (sErr) throw sErr;

const { data: cards, error: cErr } = await supabase.from('retro_cards').select('id,session_id');
if (cErr) throw cErr;

const { data: reactions, error: rErr } = await supabase
  .from('retro_card_reactions')
  .select('id,session_id');
if (rErr) throw rErr;

const hasProjectColumn = sessions.length === 0 || 'project_id' in sessions[0];
if (!hasProjectColumn) {
  console.error('retro_sessions has no project_id column — apply scripts/retro-projects-schema.sql first.');
  process.exit(1);
}

const cardsBySession = cards.reduce((acc, c) => acc.set(c.session_id, (acc.get(c.session_id) || 0) + 1), new Map());

console.log(`boards: ${sessions.length}   cards: ${cards.length}   reactions: ${reactions.length}`);
console.log(
  `baseline (pre-migration): ${BASELINE.sessions} boards, ${BASELINE.cards} cards, ${BASELINE.reactions} reactions\n`
);

for (const s of sessions) {
  const project = s.project_id ? projectName.get(s.project_id) || `unknown project ${s.project_id}` : null;
  const mark = project ? '✓' : '✗';
  console.log(
    `  ${mark} ${(project || 'UNASSIGNED').padEnd(20)} ${s.title.padEnd(32)} ${cardsBySession.get(s.id) || 0} cards  (${s.created_at.slice(0, 10)})`
  );
}

const unassigned = sessions.filter((s) => !s.project_id);
const lost = [
  sessions.length < BASELINE.sessions && `boards: ${BASELINE.sessions} → ${sessions.length}`,
  cards.length < BASELINE.cards && `cards: ${BASELINE.cards} → ${cards.length}`,
  reactions.length < BASELINE.reactions && `reactions: ${BASELINE.reactions} → ${reactions.length}`,
].filter(Boolean);

if (lost.length) {
  console.error(`\nFAIL — rows went missing since the baseline: ${lost.join(', ')}`);
  process.exit(1);
}
if (unassigned.length) {
  console.error(`\nFAIL — ${unassigned.length} board(s) name no project; they show up under no project filter.`);
  process.exit(1);
}
console.log('\nPASS — nothing lost, and every board is filed under a project.');
