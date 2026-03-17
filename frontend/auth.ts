import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    roles: z.array(z.string()),
    companyId: z.string().nullable().optional(),
    planCode: z.string().nullable().optional(),
    subscriptionStatus: z.string().nullable().optional(),
  }),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-auth-secret-change-me',
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        try {
          const response = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
            cache: 'no-store',
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();
          const session = sessionSchema.parse(data);

          return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.fullName,
            roles: session.user.roles,
            companyId: session.user.companyId ?? null,
            planCode: session.user.planCode ?? null,
            subscriptionStatus: session.user.subscriptionStatus ?? null,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = (user as { roles?: string[] }).roles ?? [];
        token.companyId = (user as { companyId?: string | null }).companyId ?? null;
        token.planCode = (user as { planCode?: string | null }).planCode ?? null;
        token.subscriptionStatus = (user as { subscriptionStatus?: string | null }).subscriptionStatus ?? null;
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? '';
      session.user.roles = (token.roles as string[]) ?? [];
      session.user.companyId = (token.companyId as string | null | undefined) ?? null;
      session.user.planCode = (token.planCode as string | null | undefined) ?? null;
      session.user.subscriptionStatus = (token.subscriptionStatus as string | null | undefined) ?? null;
      session.accessToken = token.accessToken as string | undefined;
      session.refreshToken = token.refreshToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
  debug: process.env.NODE_ENV !== 'production',
});
