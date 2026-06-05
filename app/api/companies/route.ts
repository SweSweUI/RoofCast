import { forecastCompanies } from '@/lib/forecast';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ companies: await forecastCompanies() });
  } catch (e) {
    return jsonError(e);
  }
}
