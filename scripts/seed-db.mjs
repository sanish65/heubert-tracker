import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { seedEmployees, seedFines } from '../src/data/seedData.js';

// Manual .env.local parsing
const envFilePath = resolve(process.cwd(), '.env.local');
const envFileContent = readFileSync(envFilePath, 'utf8');
const env = {};
envFileContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  try {
    console.log('🚀 Starting seeding process...');

    // 1. Seed Employees
    console.log('👥 Seeding employees...');
    const emps = seedEmployees.map(e => ({
      name: e.name,
      work_email: e.email,
      dob: e.dob,
      joined_date: e.joinedDate,
      status: 'active'
    }));

    const { data: empData, error: empError } = await supabase
      .from('employees')
      .upsert(emps, { onConflict: 'name' });

    if (empError) {
      console.error('❌ Error seeding employees:', empError.message);
      return;
    }
    console.log('✅ Employees seeded/updated!');

    // 2. Clear existing fines (optional, but requested to "update all the fines based on the person")
    // If you want to keep them, just comment out the delete line.
    console.log('🧹 Clearing existing fines for a clean seed...');
    const { error: deleteError } = await supabase.from('fines').delete().neq('id', 0);
    if (deleteError) {
        console.error('❌ Error clearing fines:', deleteError.message);
    }

    // 3. Seed Fines
    console.log('💰 Seeding fines...');
    const fines = seedFines.map(f => ({
      employee_name: f.name,
      date: f.date,
      amount: f.amount,
      status: f.status
    }));

    const { error: fineError } = await supabase.from('fines').insert(fines);

    if (fineError) {
      console.error('❌ Error seeding fines:', fineError.message);
      return;
    }
    console.log('✅ Fines seeded!');

    console.log('🎉 Seeding completed successfully!');
  } catch (err) {
    console.error('💥 Unexpected error during seeding:', err);
  }
}

seed();
