import {
  getAccountsSummary,
  getAssumptions,
  getCovenants,
  getInventory,
  getSourceFiles,
} from '@/lib/queries';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [inventory, files, accounts, assumptions, covenants] = await Promise.all([
      getInventory(),
      getSourceFiles(),
      getAccountsSummary(),
      getAssumptions(),
      getCovenants(null),
    ]);
    return Response.json({ inventory, files, accounts, assumptions, covenants });
  } catch (e) {
    return jsonError(e);
  }
}
