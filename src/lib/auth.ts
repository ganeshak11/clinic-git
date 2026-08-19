import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { withSession } from '@/lib/neo4j';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await withSession(async (session) => {
          // Invariant #5: Parameterized Cypher
          const result = await session.run(
            'MATCH (d:Doctor {email: $email}) RETURN d.id AS id, d.name AS name, d.email AS email, d.passwordHash AS passwordHash, d.isSupervisor AS isSupervisor',
            { email: credentials.email }
          );

          if (result.records.length === 0) {
            return null;
          }

          const record = result.records[0];
          if (!record) return null;

          return {
            id: record.get('id'),
            name: record.get('name'),
            email: record.get('email'),
            passwordHash: record.get('passwordHash'),
            isSupervisor: record.get('isSupervisor'),
          };
        });

        if (!user) return null;

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isSupervisor: user.isSupervisor,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isSupervisor = (user as any).isSupervisor;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).isSupervisor = token.isSupervisor as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.SESSION_SECRET,
};
