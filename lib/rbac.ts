// Role-based access control map. Roles come from Supabase user_metadata.role
// (source of truth mirrored in altis_profiles). Demo-grade authz; a production
// build would use a signed custom claim in app_metadata.
export type Role = 'cfo' | 'board' | 'opco' | 'project' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  cfo: 'CFO',
  board: 'PE Board',
  opco: 'Opco MD',
  project: 'Project Lead',
  admin: 'Administrator',
};

// Which top-level dashboard segments each role may access.
export const ACCESS: Record<Role, string[]> = {
  admin: ['cfo', 'board', 'opco', 'project', 'data-quality', 'methodology', 'admin'],
  cfo: ['cfo', 'board', 'opco', 'project', 'data-quality', 'methodology'],
  board: ['board', 'methodology'],
  opco: ['opco', 'project', 'methodology'],
  project: ['project', 'methodology'],
};

export const DEFAULT_ROUTE: Record<Role, string> = {
  admin: '/admin',
  cfo: '/cfo',
  board: '/board',
  opco: '/opco',
  project: '/project',
};

export function canAccess(role: string, segment: string): boolean {
  const allowed = ACCESS[(role as Role)] ?? ACCESS.project;
  return allowed.includes(segment);
}

export function defaultRouteFor(role: string): string {
  return DEFAULT_ROUTE[(role as Role)] ?? '/project';
}
