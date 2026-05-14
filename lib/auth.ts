export type Role = 'Product';

export interface Session {
  name: string;
  role: Role;
}

export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

export const VALID_ROLES: Role[] = ['Product'];

export function roleToPath(_role: Role): string {
  return '/dashboard';
}
