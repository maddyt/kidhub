// Seeds the demo from a terminal. Usage: npm run seed:demo  (reads .env.local)
//                                         npm run seed:demo -- --remove
// No terminal? Use the "Set up demo data" link on the login page instead.
import { createClient } from '@supabase/supabase-js';
import { seedDemo, removeDemo } from '../src/lib/demo-seed.ts';
import { DEMO_ACCOUNTS } from '../src/lib/demo.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, password = process.env.DEMO_PASSWORD ?? '';
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

if (process.argv.includes('--remove')) {
  await removeDemo(db);
  console.log('Demo removed.');
} else {
  const { children } = await seedDemo(db, password);
  console.log(`Demo ready: ${children} children across 2 schools. Demo logins:`);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.label.padEnd(12)} ${a.email}`);
}
