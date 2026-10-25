import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/login', '/signup', '/join', '/api/cron', '/demo', '/forgot', '/auth'];

/**
 * Content-Security-Policy with a per-request nonce: only scripts Next.js renders with that nonce (and the
 * chunks they load) can run, so injected script tags are blocked. Next.js reads the nonce from this header.
 */
function contentSecurityPolicy(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseWs = supabase.replace(/^http/, 'ws');
  const dev = process.env.NODE_ENV !== 'production';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supabase}`,
    `font-src 'self'`,
    // Live video segments come from camera/CDN hosts, which differ per school.
    `connect-src 'self' ${supabase} ${supabaseWs} https:`,
    `media-src 'self' blob: https:`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(!dev && supabase.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

// Refreshes the Supabase session cookie on every request, sends signed-out users to /login, and sets the CSP.
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce);
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', csp);
  const withCsp = (res: NextResponse) => { res.headers.set('content-security-policy', csp); return res; };

  let response = NextResponse.next({ request: { headers: request.headers } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return withCsp(response); // the page itself explains the missing configuration

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: request.headers } });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && path !== '/' && !PUBLIC.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return withCsp(NextResponse.redirect(login));
  }
  return withCsp(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
