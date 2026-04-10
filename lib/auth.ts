export type Role = 'Marketing' | 'Content' | 'Product' | 'Admin';

export interface Session {
  name: string;
  role: Role;
}

export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

export const VALID_ROLES: Role[] = ['Marketing', 'Content', 'Product', 'Admin'];

export function roleToPath(role: Role): string {
  switch (role) {
    case 'Marketing': return '/dashboard/marketing';
    case 'Content': return '/dashboard/content';
    case 'Product': return '/dashboard/product';
    case 'Admin': return '/dashboard/admin';
  }
}
