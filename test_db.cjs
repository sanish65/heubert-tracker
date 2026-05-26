const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: session, error: sErr } = await supabase
    .from('retro_sessions').insert({ title: 'Test', created_by: 'Test', template: 'sailboat' }).select().single();
  
  let sid = session?.id;
  if (!sid) {
    const { data: s2 } = await supabase.from('retro_sessions').insert({ title: 'Test [sailboat]', created_by: 'Test' }).select().single();
    sid = s2?.id;
  }

  console.log("Session ID:", sid);

  const { data, error } = await supabase
    .from('retro_cards')
    .insert({ session_id: sid, column_type: 'wind', content: 'test content', author: 'tester' })
    .select().single();

  console.log("Insert result:", error || "Success");
  
  if (sid) {
      await supabase.from('retro_sessions').delete().eq('id', sid);
  }
}

test();
