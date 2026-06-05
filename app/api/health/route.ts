import { getCompanies } from '@/lib/queries';
import { activeBackend } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = activeBackend();
  try {
    const c = await getCompanies();
    return Response.json({ ready: c.length > 0, backend, companies: c.length });
  } catch (e) {
    return Response.json({ ready: false, backend, reason: (e as Error).message });
  }
}
