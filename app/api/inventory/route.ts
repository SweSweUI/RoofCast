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
    return Response.json({
      inventory: getInventory(),
      files: getSourceFiles(),
      accounts: getAccountsSummary(),
      assumptions: getAssumptions(),
      covenants: getCovenants(null),
    });
  } catch (e) {
    return jsonError(e);
  }
}
