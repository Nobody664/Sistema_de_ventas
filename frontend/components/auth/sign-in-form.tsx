'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const signInSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: 'owner@demo.com',
      password: 'password123',
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
      setError('No se pudo iniciar sesión con las credenciales enviadas.');
      return;
    }

    window.location.href = result?.url ?? '/dashboard';
  });

  return (
    <Card className="w-full max-w-md rounded-[34px] bg-white/85 p-8">
      <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Acceso privado</p>
      <h1 className="mt-4 font-display text-4xl">Inicia sesión en tu operación.</h1>
      <p className="mt-3 text-sm leading-7 text-foreground/62">
        Esta pantalla usa React Hook Form, Zod y NextAuth para conectar con el backend NestJS.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 outline-none transition focus:border-primary"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-primary">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 outline-none transition focus:border-primary"
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-primary">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-primary">{error}</p> : null}

        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Continuar
        </Button>
      </form>
    </Card>
  );
}

