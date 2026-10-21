"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "El enlace no es válido o no contiene el token de recuperación.",
      );
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "No se pudo restablecer la contraseña");
      }

      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al restablecer la contraseña",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>
            Tu contraseña se actualizó correctamente. Redirigiendo al inicio de
            sesión...
          </p>
        </div>
        <p className="text-center text-sm text-white/50">
          <Link
            href="/sign-in"
            className="font-medium text-white hover:text-violet-400 transition-colors"
          >
            Ir a iniciar sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error ? (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-white" htmlFor="password">
          Nueva contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-white"
          htmlFor="confirmPassword"
        >
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="••••••••"
        />
      </div>

      <Button
        className="w-full rounded-xl bg-white text-black hover:bg-white/90 hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5 h-12 transition-all duration-300"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          "Restablecer contraseña"
        )}
      </Button>

      <p className="text-center text-sm text-white/50">
        <Link
          href="/sign-in"
          className="font-medium text-white hover:text-violet-400 transition-colors"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
