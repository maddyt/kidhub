import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server.ts';

/** Landing point for links in Supabase emails (password reset): swaps the one-time code for a session. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, req.url));
  }
  return NextResponse.redirect(new URL('/login?reset=failed', req.url));
}
