"use client";

import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        devToken?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "No se pudo procesar la solicitud");
      }

      setSent(true);
      if (data.devToken) {
        setDevToken(data.devToken);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al enviar la solicitud",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p>
            Si existe una cuenta con ese correo, enviaremos un enlace para
            restablecer la contraseña. Revisa tu bandeja de entrada y spam.
          </p>
        </div>

        {devToken ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-white/50">
              Entorno de desarrollo: usa este enlace para continuar.
            </p>
            <Link
              href={`/reset-password?token=${devToken}`}
              className="break-all text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Restablecer contraseña
            </Link>
          </div>
        ) : null}

        <p className="text-center text-sm text-white/50">
          <Link
            href="/sign-in"
            className="font-medium text-white hover:text-violet-400 transition-colors"
          >
            Volver a iniciar sesión
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
        <label className="text-sm font-medium text-white" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-violet-500/50 focus:bg-white/10 focus:shadow-lg focus:shadow-violet-500/10"
          placeholder="tu@email.com"
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
          "Enviar enlace de recuperación"
        )}
      </Button>

      <p className="text-center text-sm text-white/50">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 font-medium text-white hover:text-violet-400 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
