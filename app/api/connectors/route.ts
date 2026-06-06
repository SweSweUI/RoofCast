import { connectorsFromSources } from '@/lib/connectors';
import { getSourceFiles } from '@/lib/queries';
import { jsonError } from '@/lib/server/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sourceFiles = await getSourceFiles();
    const connectors = connectorsFromSources(sourceFiles);
    return Response.json({
      connectors,
      sourceFileCount: sourceFiles.length,
      note: 'Only safe connector metadata is returned. Credentials and refresh tokens must stay server-side.',
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? '');
    const connectors = connectorsFromSources(await getSourceFiles());
    const connector = connectors.find((c) => c.id === id);
    if (!connector) return Response.json({ error: 'unknown_connector', id }, { status: 404 });

    return Response.json({
      id: connector.id,
      name: connector.name,
      status: connector.status,
      setupMode: connector.authType,
      nextAction: connector.nextAction,
      credentialHandling: connector.safeMetadata,
      message:
        connector.authType === 'file_import'
          ? 'File/import route is active. Keep using it as fallback while live API credentials are configured server-side.'
          : 'Connector setup prepared. Add credentials on the server side; do not place secrets in client code.',
    });
  } catch (e) {
    return jsonError(e);
  }
}
