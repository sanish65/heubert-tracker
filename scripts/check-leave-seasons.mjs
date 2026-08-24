// LEAVE SEASON INTEGRITY CHECK  (read-only)
//   node scripts/check-leave-seasons.mjs
//
// Asserts the invariant that a leave recorded while a leave season already existed must
// carry that season's id. A NULL season_id on such a row means the leave silently vanished
// from the season-scoped Leave Calendar and from the season's balances, even though it
// still appears in the Dashboard's "Upcoming Leaves" list.
//
// Rows created before the first season are genuinely pre-season and are expected to be NULL.
// Requires Node 20+ (supabase-js needs a global fetch/Headers).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manual .env.local parsing
const envFileContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const env = {};
envFileContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: seasons, error: seasonErr } = await supabase
  .from('leave_seasons')
  .select('id,title,created_at')
  .order('created_at', { ascending: true });
if (seasonErr) throw seasonErr;

const { data: leaves, error: leaveErr } = await supabase
  .from('leaves')
  .select('id,employee_name,start_date,season_id,created_at')
  .order('created_at', { ascending: true });
if (leaveErr) throw leaveErr;

if (!seasons.length) {
  console.log('No leave seasons exist yet — every leave is legitimately pre-season. OK');
  process.exit(0);
}

const seasonAt = (createdAt) =>
  [...seasons].reverse().find((s) => s.created_at <= createdAt) || null;

const preSeason = leaves.filter((l) => l.season_id === null && !seasonAt(l.created_at));
const orphaned = leaves.filter((l) => l.season_id === null && seasonAt(l.created_at));
const misfiled = leaves.filter(
  (l) => l.season_id !== null && seasonAt(l.created_at) && l.season_id !== seasonAt(l.created_at).id
);

console.log(`seasons: ${seasons.length}   leaves: ${leaves.length}`);
console.log(`legitimately pre-season (NULL, expected): ${preSeason.length}`);
console.log(`recorded into an older season than was current: ${misfiled.length}`);
console.log(`ORPHANED (NULL but a season existed): ${orphaned.length}`);

for (const l of orphaned) {
  console.log(`  ✗ id=${l.id} ${l.employee_name} ${l.start_date} (created ${l.created_at}) → should be season ${seasonAt(l.created_at).id}`);
}

if (orphaned.length) {
  console.error('\nFAIL — apply scripts/leave-season-backfill.sql to repair these rows.');
  process.exit(1);
}
console.log('\nPASS — every leave recorded since seasons existed carries a season.');
