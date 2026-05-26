import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const p = {};
envFile.split('\n').filter(Boolean).forEach(l => {
  const [k, v] = l.split('=');
  if (k && v) p[k.trim()] = v.trim();
});

const supabase = createClient(p.NEXT_PUBLIC_SUPABASE_URL, p.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: session, error: sErr } = await supabase.from('retro_sessions').select('title, template').eq('id', 'e4038be2-9ee3-4096-a2c3-395c8c282870').single();
  console.log(session, sErr);
  
  // also test without template
  const { data: s2, error: e2 } = await supabase.from('retro_sessions').select('*').eq('id', 'e4038be2-9ee3-4096-a2c3-395c8c282870').single();
  console.log(s2, e2);
}
test();
