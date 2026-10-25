import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server.ts';
import { runBilling } from '@/lib/data/billing.ts';
import { env } from '@/lib/env.ts';

export const dynamic = 'force-dynamic';

/** Daily Vercel cron: issue recurring invoices for every school. Requires CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const result = await runBilling(supabaseAdmin());
  return NextResponse.json(result);
}
