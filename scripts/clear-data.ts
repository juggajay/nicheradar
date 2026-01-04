// Script to clear all opportunity data for fresh scan
// Run with: npx tsx scripts/clear-data.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY
);

async function clearAllData() {
  console.log('Clearing all opportunity data...\n');

  // Delete in order (respecting foreign keys)
  const tables = [
    'youtube_supply',
    'topic_signals',
    'topic_sources',
    'opportunities',
    'topics',
  ];

  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) {
      console.log(`  ${table}: Error - ${error.message}`);
    } else {
      console.log(`  ${table}: Cleared`);
    }
  }

  console.log('\nDone! Ready for fresh scan.');
}

clearAllData().catch(console.error);
