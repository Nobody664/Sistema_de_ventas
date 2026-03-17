'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';

const signInSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setError(null);

    const result = await signIn('credentials', {
      ...values,
      redirect: false,
      callbackUrl: '/dashboard',
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError('Credenciales incorrectas. Por favor intenta de nuevo.');
      return;
    }

    router.push(result?.url ?? '/dashboard');
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-white" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="tu@email.com"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Contraseña
          </label>
          <Link href="/forgot-password" className="text-xs text-white/50 hover:text-violet-400 transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="••••••••"
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <Button 
        className="w-full rounded-xl bg-white text-black hover:bg-white/90 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 h-12 transition-all duration-300" 
        type="submit" 
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          'Iniciar sesión'
        )}
      </Button>

      <p className="text-center text-sm text-white/50">
        ¿No tienes una cuenta?{' '}
        <Link href="/sign-up" className="font-medium text-white hover:text-violet-400 transition-colors">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
