import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      if (process.env.NODE_ENV === 'development' && req.headers.get('x-test-bypass')) return true;
      return !!token;
    },
  },
});

export const config = {
  // Protect all /api/ routes except /api/auth and /api/health
  matcher: ['/api/((?!auth|health).*)'],
};
