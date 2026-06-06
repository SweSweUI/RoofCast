import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTEBOOK_NAME = 'altis_app_forecast_reproduction_and_evidence.ipynb';

export async function GET() {
  const notebookPath = path.join(process.cwd(), 'notebooks', NOTEBOOK_NAME);

  try {
    const [buf, info] = await Promise.all([readFile(notebookPath), stat(notebookPath)]);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/x-ipynb+json',
        'Content-Disposition': `attachment; filename="${NOTEBOOK_NAME}"`,
        'Content-Length': String(info.size),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      {
        error: 'notebook_not_found',
        message:
          'Analyst notebook is missing. Generate it with: python3 scripts/create_app_parity_notebook.py',
      },
      { status: 404 },
    );
  }
}
