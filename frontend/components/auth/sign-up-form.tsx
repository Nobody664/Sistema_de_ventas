'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { validatePhone, validateTextOnly, formatPhone, PERU_VALIDATIONS } from '@/lib/validations';

const signUpSchema = z.object({
  fullName: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .refine((val) => validateTextOnly(val), { message: 'Solo se permiten letras' }),
  companyName: z.string()
    .min(2, 'El nombre de empresa debe tener al menos 2 caracteres')
    .max(150, 'El nombre de empresa no puede exceder 150 caracteres'),
  email: z.string()
    .email('Correo invalido')
    .max(255, 'El correo no puede exceder 255 caracteres'),
  phone: z.string()
    .optional()
    .refine((val) => !val || validatePhone(val), { message: PERU_VALIDATIONS.phone.error }),
  password: z.string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .max(100, 'La contrasena no puede exceder 100 caracteres'),
  confirmPassword: z.string(),
  planCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contrasenas no coinciden',
  path: ['confirmPassword'],
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      companyName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      planCode: searchParams.get('plan') ?? undefined,
    },
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const formatted = formatPhone(input.value);
    form.setValue('phone', formatted);
  };

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
          phone: values.phone || undefined,
          password: values.password,
          planCode: values.planCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Error al registrar usuario' }));
        throw new Error(data.message || 'Error al registrar usuario');
      }

      const result = await response.json();

      if (result.accessToken) {
        await signIn('credentials', {
          email: values.email,
          password: values.password,
          redirect: false,
          callbackUrl: '/dashboard',
        });
      } else {
        throw new Error('No se recibio token de autenticacion');
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar usuario');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-2xl shadow-black/50">
      <p className="text-sm uppercase tracking-[0.18em] text-white/50">Registro</p>
      <h1 className="mt-2 font-display text-3xl text-white">Crea tu empresa</h1>
      <p className="mt-3 text-sm leading-7 text-white/50">
        Registrate para crear tu empresa y comenzar a gestionar tus operaciones.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="fullName">
            Nombre completo
          </label>
          <input
            id="fullName"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('fullName')}
          />
          {form.formState.errors.fullName ? (
            <p className="text-xs text-red-400">{form.formState.errors.fullName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="companyName">
            Nombre de la empresa
          </label>
          <input
            id="companyName"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('companyName')}
          />
          {form.formState.errors.companyName ? (
            <p className="text-xs text-red-400">{form.formState.errors.companyName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="phone">
            Telefono (opcional)
          </label>
          <input
            id="phone"
            type="tel"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            placeholder="+51 900 000 000"
            maxLength={15}
            onChange={handlePhoneChange}
          />
          {form.formState.errors.phone ? (
            <p className="text-xs text-red-400">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="confirmPassword">
            Confirmar contrasena
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword ? (
            <p className="text-xs text-red-400">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Button className="w-full bg-white text-black hover:bg-white/90 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 h-12 transition-all duration-300" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}
