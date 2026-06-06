import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccess, defaultRouteFor } from '@/lib/rbac';

const DASH_SEGMENTS = ['cfo', 'board', 'map', 'agent', 'connectors', 'opco', 'project', 'data-quality', 'methodology', 'admin'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  // If Supabase isn't configured, don't gate anything (local SQLite-only mode).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isLogin = path === '/login';
  const isApi = path.startsWith('/api/');
  const isHealth = path === '/api/health';

  // Unauthenticated
  if (!user) {
    if (isLogin || isHealth) return res;
    if (isApi) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Authenticated
  const role = ((user.user_metadata ?? {}).role as string) ?? 'project';
  if (isLogin) return NextResponse.redirect(new URL(defaultRouteFor(role), req.url));

  // RBAC on dashboard routes
  const seg = path.split('/')[1];
  if (DASH_SEGMENTS.includes(seg) && !canAccess(role, seg)) {
    return NextResponse.redirect(new URL(defaultRouteFor(role), req.url));
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico)$).*)'],
};
