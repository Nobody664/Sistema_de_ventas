"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuthStore } from "@/stores/auth.store";
import { getSignInDestination } from "@/lib/role-navigation";
import type { AuthStage } from "@/lib/auth-readiness";

const signInSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<AuthStage | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    setIsSubmitting(true);
    setError(null);

    try {
      await login(values.email, values.password, {
        signal: controller.signal,
        onStage: setStage,
      });
      if (controller.signal.aborted) return;
      router.replace(
        getSignInDestination(
          searchParams.get("redirect"),
          useAuthStore.getState().user?.roles ?? [],
        ),
      );
      router.refresh();
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error ? err.message : "No se pudo iniciar sesión",
        );
    } finally {
      submittingRef.current = false;
      requestRef.current = null;
      setStage(null);
      setIsSubmitting(false);
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit} aria-busy={isSubmitting}>
      <GoogleSignInButton />

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-white" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          autoComplete="username"
          disabled={isSubmitting}
          type="email"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="tu@email.com"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-400">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white" htmlFor="password">
            Contraseña
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-white/50 hover:text-violet-400 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            type={showPassword ? "text" : "password"}
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 pr-12 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
            placeholder="••••••••"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p className="text-xs text-red-400">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <Button
        className="w-full rounded-xl bg-white text-black hover:bg-white/90 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 h-12 transition-all duration-300"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            {stage === "connecting"
              ? "Conectando con el servidor…"
              : "Verificando acceso…"}
          </>
        ) : (
          "Iniciar sesión"
        )}
      </Button>

      {stage === "connecting" && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-2 text-center text-xs leading-relaxed text-white/60"
        >
          <p>
            Si el servidor estaba en reposo, puede tardar hasta un minuto y
            medio en activarse. No necesitas volver a pulsar.
          </p>
          <button
            type="button"
            className="text-white underline underline-offset-4"
            onClick={() => requestRef.current?.abort()}
          >
            Cancelar espera
          </button>
        </div>
      )}

      <p className="text-center text-sm text-white/50">
        ¿No tienes una cuenta?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-white hover:text-violet-400 transition-colors"
        >
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
