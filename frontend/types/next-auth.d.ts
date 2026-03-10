import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      roles: string[];
      companyId?: string | null;
    };
  }

  interface User {
    roles?: string[];
    companyId?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    roles?: string[];
    companyId?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}

