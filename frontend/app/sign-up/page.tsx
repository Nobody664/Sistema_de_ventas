import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignUpForm } from '@/components/auth/sign-up-form';

export default async function SignUpPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="container flex min-h-screen items-center justify-center py-12">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_460px]">
        <div className="space-y-6">
          <span className="eyebrow">Autenticación SaaS</span>
          <h1 className="font-display text-5xl md:text-6xl">Crea tu cuenta y empresa</h1>
          <p className="max-w-2xl text-lg leading-8 text-foreground/65">
            Regístrate para crear tu empresa y comenzar a gestionar tus operaciones.
            Obtendrás acceso de administrador para gestionar todos los aspectos.
          </p>
        </div>
        <SignUpForm />
      </div>
    </main>
  );
}
