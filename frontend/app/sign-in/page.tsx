import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignInForm } from '@/components/auth/sign-in-form';

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_460px]">
        <div className="space-y-6">
          <span className="eyebrow">Autenticación SaaS</span>
          <h1 className="font-display text-5xl md:text-6xl">Una sola entrada para cada empresa, rol y operación.</h1>
          <p className="max-w-2xl text-lg leading-8 text-foreground/65">
            La base contempla login con JWT, refresh tokens y RBAC, dejando espacio para SSO, MFA y auditoría
            reforzada en la siguiente iteración.
          </p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
