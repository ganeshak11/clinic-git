import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rate-limit';

const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      // Test auth: requires a shared secret, not NODE_ENV
      const testSecret = process.env.TEST_AUTH_SECRET;
      if (testSecret && req.headers.get('x-test-auth-secret') === testSecret) {
        return true;
      }
      return !!token;
    },
  },
});

export default function middleware(req: NextRequest, event: any) {
  const ip = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!rateLimiter.check(ip)) {
    return new NextResponse(
      JSON.stringify({ error: 'Too Many Requests' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // @ts-ignore - next-auth middleware types are complex but it accepts (req, event)
  return authMiddleware(req, event);
}

export const config = {
  // Protect all /api/ routes except /api/auth and /api/health
  matcher: ['/api/((?!auth|health).*)'],
};
