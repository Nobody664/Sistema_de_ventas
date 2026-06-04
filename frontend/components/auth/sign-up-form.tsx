'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { register as apiRegister } from '@/lib/api/auth';
import { setTokens } from '@/lib/api/auth';

const signUpSchema = z.object({
  fullName: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .refine((val) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(val), { message: 'Solo se permiten letras' }),
  companyName: z.string()
    .min(2, 'El nombre de empresa debe tener al menos 2 caracteres')
    .max(150, 'El nombre de empresa no puede exceder 150 caracteres'),
  email: z.string()
    .email('Correo inválido — debe incluir @ (ej: usuario@dominio.com)')
    .max(255, 'El correo no puede exceder 255 caracteres'),
  phone: z.string()
    .min(9, 'Debe tener 9 dígitos')
    .max(9, 'Debe tener 9 dígitos')
    .refine((val) => /^9\d{8}$/.test(val), { message: 'Debe comenzar con 9 y tener 9 dígitos' }),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres')
    .refine((val) => /[A-Z]/.test(val), { message: 'Debe contener al menos una mayúscula' })
    .refine((val) => /[0-9]/.test(val), { message: 'Debe contener al menos un número' })
    .refine((val) => /[^A-Za-z0-9]/.test(val), { message: 'Debe contener al menos un símbolo especial (@$!%*?&#.-_)' }),
  confirmPassword: z.string(),
  planCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type SignUpValues = z.infer<typeof signUpSchema>;

const PASSWORD_REQUIREMENTS = [
  { label: 'Mínimo 8 caracteres', test: (v: string) => v.length >= 8 },
  { label: 'Una letra mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Un número', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Un símbolo especial (@$!%*?&#.-_)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
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

  const passwordValue = form.watch('password');
  const confirmPasswordValue = form.watch('confirmPassword');
  const passwordTouched = form.formState.touchedFields.password;
  const passwordDirty = form.formState.dirtyFields.password;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    form.setValue('phone', raw, { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiRegister({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        companyName: values.companyName,
      });

      setTokens(response.accessToken, response.refreshToken);
      router.push('/dashboard');
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
            Nombre completo <span className="text-red-400">*</span>
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
            Nombre de la empresa <span className="text-red-400">*</span>
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
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            placeholder="ejemplo@correo.com"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="phone">
            Celular <span className="text-red-400">*</span>
          </label>
          <div className="flex items-stretch">
            <div className="flex h-12 items-center rounded-2xl rounded-r-none border border-r-0 border-white/10 bg-white/10 px-3 text-sm text-white/70 whitespace-nowrap">
              +51
            </div>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="999 999 999"
              value={formatPhoneDigits(form.watch('phone'))}
              onChange={handlePhoneChange}
              className="h-12 w-full rounded-2xl rounded-l-none border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            />
          </div>
          {form.formState.errors.phone ? (
            <p className="text-xs text-red-400">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Contraseña <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-4 pr-12 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {form.formState.errors.password ? (
            <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
          ) : null}

          {(passwordTouched || passwordDirty) && passwordValue ? (
            <ul className="mt-2 space-y-1.5">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.test(passwordValue);
                return (
                  <li
                    key={req.label}
                    className={cn(
                      'flex items-center gap-2 text-xs transition-colors duration-200',
                      met ? 'text-emerald-400' : 'text-white/40',
                    )}
                  >
                    {met ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                    {req.label}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {PASSWORD_REQUIREMENTS.map((req) => (
                <li key={req.label} className="flex items-center gap-2 text-xs text-white/30">
                  <X className="size-3.5 shrink-0" />
                  {req.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="confirmPassword">
            Confirmar contraseña <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-4 pr-12 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
              {...form.register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {confirmPasswordValue ? (
            <div className="flex items-center gap-2 mt-2">
              {confirmPasswordValue === passwordValue ? (
                <>
                  <Check className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Las contraseñas coinciden</span>
                </>
              ) : (
                <>
                  <X className="size-3.5 shrink-0 text-red-400" />
                  <span className="text-xs text-red-400">Las contraseñas no coinciden</span>
                </>
              )}
            </div>
          ) : null}
          {form.formState.errors.confirmPassword && form.formState.errors.confirmPassword.message !== 'Las contraseñas no coinciden' ? (
            <p className="text-xs text-red-400 mt-1">{form.formState.errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <Button
          className="w-full bg-white text-black hover:bg-white/90 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 h-12 transition-all duration-300"
          size="lg"
          type="submit"
          disabled={isSubmitting || !form.formState.isValid}
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}
