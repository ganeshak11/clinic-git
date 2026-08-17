import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  // Protect all /api/ routes except /api/auth and /api/health
  matcher: ['/api/((?!auth|health).*)'],
};
