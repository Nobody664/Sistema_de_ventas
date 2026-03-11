'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const signUpSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  companyName: z.string().min(2, 'El nombre de empresa debe tener al menos 2 caracteres'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      companyName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName,
          companyName: values.companyName,
          email: values.email,
          password: values.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Error al registrar usuario' }));
        throw new Error(data.message || 'Error al registrar usuario');
      }

      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        setError('Error al iniciar sesión después del registro');
        return;
      }

      window.location.href = result?.url ?? '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar usuario');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Card className="w-full max-w-md rounded-[34px] bg-white/85 p-8">
      <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Registro</p>
      <h1 className="mt-4 font-display text-4xl">Crea tu empresa</h1>
      <p className="mt-3 text-sm leading-7 text-foreground/62">
        Regístrate para crear tu empresa y comenzar a gestionar tus operaciones.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fullName">
            Nombre completo
          </label>
          <input
            id="fullName"
            className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 outline-none transition focus:border-primary"
            {...form.register('fullName')}
          />
          {form.formState.errors.fullName ? (
            <p className="text-xs text-primary">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="companyName">
            Nombre de la empresa
          </label>
          <input
            id="companyName"
            className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 outline-none transition focus:border-primary"
            {...form.register('companyName')}
          />
          {form.formState.errors.companyName ? (
            <p className="text-xs text-primary">{form.formState.errors.companyName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
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

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="h-12 w-full rounded-2xl border border-foreground/10 bg-background px-4 outline-none transition focus:border-primary"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-primary">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-primary">{error}</p> : null}

        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Crear cuenta
        </Button>
      </form>
    </Card>
  );
}
