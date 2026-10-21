"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AnimatedSection } from "@/components/ui/animations";

export function ForgotPasswordPageClient() {
  return (
    <main className="flex min-h-screen bg-black">
      {/* Left Side - Form */}
      <div className="relative flex w-full items-center justify-center overflow-hidden px-4 py-12 sm:px-8 lg:w-1/2">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-900/20 via-black to-black" />
        <div className="absolute top-20 left-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full max-w-md">
          <AnimatedSection>
            <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl shadow-black/50 sm:p-8">
              <Link
                href="/sign-in"
                className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Volver
              </Link>
              <div className="mb-6">
                <h1 className="font-display text-3xl text-white">
                  Recuperar contraseña
                </h1>
                <p className="mt-2 text-white/50">
                  Ingresa tu correo y te enviaremos un enlace para
                  restablecerla.
                </p>
              </div>
              <ForgotPasswordForm />
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-violet-900 to-black relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="relative z-10 max-w-md px-12 text-center">
          <AnimatedSection delay={200}>
            <div className="mb-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-black shadow-xl shadow-white/20">
                V
              </div>
            </div>
            <h2 className="font-display text-3xl text-white">
              Recupera el acceso a tu cuenta
            </h2>
            <p className="mt-4 text-lg text-white/50">
              Te enviaremos un enlace seguro para que puedas crear una nueva
              contraseña.
            </p>
          </AnimatedSection>
        </div>
      </div>
    </main>
  );
}
