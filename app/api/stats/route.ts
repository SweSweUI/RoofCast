import { getStatsArtifact } from '@/lib/queries';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = getStatsArtifact('stats.json');
    if (!s) {
      return Response.json({
        pending: true,
        message: 'Statistics artifact not generated yet. Run: npm run stats',
      });
    }
    return Response.json(s);
  } catch (e) {
    return jsonError(e);
  }
}
