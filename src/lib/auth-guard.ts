import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Authenticated user context extracted from session or test headers.
 * userId and isSupervisor are NEVER client-supplied in production.
 */
export interface AuthContext {
  userId: string;
  isSupervisor: boolean;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extract auth context from the NextAuth session (production path).
 */
async function getSessionAuth(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { id?: string; isSupervisor?: boolean };
  if (!user.id) return null;
  return {
    userId: user.id,
    isSupervisor: user.isSupervisor === true,
  };
}

/**
 * Extract auth context from test headers — ONLY works when TEST_AUTH_SECRET
 * env var is set AND the request provides the matching secret.
 *
 * This replaces the dangerous NODE_ENV === 'development' bypass.
 * The secret is only configured in test/CI environments.
 */
function getTestAuth(request: NextRequest): AuthContext | null {
  const testSecret = process.env.TEST_AUTH_SECRET;
  if (!testSecret) return null;
  if (request.headers.get('x-test-auth-secret') !== testSecret) return null;
  const userId = request.headers.get('x-test-user-id');
  if (!userId) return null;
  return {
    userId,
    isSupervisor: request.headers.get('x-test-is-supervisor') === 'true',
  };
}

/**
 * Require authentication. Returns AuthContext or throws AuthError.
 *
 * Priority:
 * 1. NextAuth session (production)
 * 2. Test headers with secret (testing only)
 * 3. Throw AuthError
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const ctx = (await getSessionAuth()) ?? getTestAuth(request);
  if (!ctx) throw new AuthError('Unauthorized');
  return ctx;
}

/**
 * Optional auth — returns null instead of throwing.
 * Used for endpoints where we want to check auth without blocking.
 */
export async function optionalAuth(request: NextRequest): Promise<AuthContext | null> {
  return (await getSessionAuth()) ?? getTestAuth(request);
}
