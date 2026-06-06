'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { ROLE_LABEL, defaultRouteFor, type Role } from '@/lib/rbac';

const DEMO: { email: string; role: Role }[] = [
  { email: 'cfo@altis.demo', role: 'cfo' },
  { email: 'board@altis.demo', role: 'board' },
  { email: 'opco@altis.demo', role: 'opco' },
  { email: 'project@altis.demo', role: 'project' },
  { email: 'admin@altis.demo', role: 'admin' },
];
const DEMO_PASSWORD = 'AltisDemo!2026';
const SUPABASE_AUTH_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function LoginPage() {
  const [email, setEmail] = useState('cfo@altis.demo');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(true);
    setError(null);

    if (!SUPABASE_AUTH_ENABLED) {
      const demo = DEMO.find((d) => d.email === (creds?.email ?? email));
      window.location.assign(defaultRouteFor(demo?.role ?? 'cfo'));
      return;
    }

    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword(
        creds ?? { email, password },
      );
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const role = (data.user?.user_metadata?.role as string) ?? 'project';
      // full navigation so the freshly-set session cookie reaches the middleware
      window.location.assign(defaultRouteFor(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      return;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel-sunken p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-ink text-base font-bold text-white">A</div>
          <div>
            <div className="text-base font-semibold text-ink">Altis</div>
            <div className="text-2xs text-ink-faint">Weather-aware cashflow</div>
          </div>
        </div>

        <div className="rounded-lg border border-panel-line bg-panel p-5 shadow-card">
          <h1 className="text-sm font-semibold text-ink">Sign in</h1>
          <p className="mt-0.5 text-2xs text-ink-muted">
            {SUPABASE_AUTH_ENABLED ? 'Role-based access · Supabase Auth' : 'Local demo mode · no sign-in required'}
          </p>

          {!SUPABASE_AUTH_ENABLED && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
              Supabase auth is disabled for this local server. Use a role button below to open the dashboard.
            </div>
          )}

          <form onSubmit={signIn} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Email</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-1 w-full rounded-md border border-panel-line bg-panel px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
            <label className="block">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-faint">Password</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="mt-1 w-full rounded-md border border-panel-line bg-panel px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
            {error && <p className="text-2xs text-risk-high">{error}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-md bg-ink py-2 text-sm font-medium text-white hover:bg-ink-soft disabled:opacity-50"
            >
              {busy ? 'Opening…' : SUPABASE_AUTH_ENABLED ? 'Sign in' : 'Open dashboard'}
            </button>
          </form>

          <div className="mt-4 border-t border-panel-line pt-3">
            <p className="mb-2 text-2xs text-ink-faint">
              {SUPABASE_AUTH_ENABLED ? <>Demo accounts (password <code>{DEMO_PASSWORD}</code>):</> : 'Open as role:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); signIn(undefined, { email: d.email, password: DEMO_PASSWORD }); }}
                  disabled={busy}
                  className="rounded border border-panel-line bg-panel-sunken px-2 py-1 text-2xs text-ink-soft hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {ROLE_LABEL[d.role]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
          Altis data is anonymised and for the hackathon only. Copies must be deleted within 3 days
          after the event.
        </p>
      </div>
    </div>
  );
}
