import { getSessionUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Portfolio data tables (NOT altis_profiles — users are removed only by the CLI
// full teardown, scripts/purge.sh). TRUNCATE … CASCADE clears the data, keeping
// the schema so the app can be re-seeded with `npm run pipeline && push`.
const DATA_TABLES = [
  'altis_trace_links', 'altis_forecast_weeks', 'altis_weekly_financials',
  'altis_transactions', 'altis_accounts', 'altis_monthly_revenue',
  'altis_weather_weekly', 'altis_weather_daily', 'altis_weather_locations',
  'altis_covenants', 'altis_assumptions', 'altis_source_files',
  'altis_pipeline_runs', 'altis_companies',
];

async function mgmtQuery(sql: string) {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !tok) throw new Error('Supabase management credentials not configured');
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', 'User-Agent': 'altis-web/1.0' },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`Management API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  if (body.confirm !== 'DELETE') {
    return Response.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  }
  try {
    await mgmtQuery(`TRUNCATE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE;`);
    return Response.json({
      ok: true,
      truncated: DATA_TABLES.length,
      message:
        'Portfolio data cleared from Supabase. The schema and user accounts remain. ' +
        'Re-seed with `npm run pipeline && npm run snapshot && python3 pipeline/push_supabase.py`. ' +
        'For a full teardown (drop all altis_ objects + demo users), run scripts/purge.sh.',
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
