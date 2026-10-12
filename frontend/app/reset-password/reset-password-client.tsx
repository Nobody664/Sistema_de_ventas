'use client';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AnimatedSection } from '@/components/ui/animations';

export function ResetPasswordPageClient() {
  return (
    <main className="flex min-h-screen bg-black">
      {/* Left Side - Form */}
      <div className="flex w-full items-center justify-center px-8 py-12 lg:w-1/2 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-900/20 via-black to-black" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full max-w-md">
          <AnimatedSection>
            <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-2xl shadow-black/50">
              <div className="mb-8">
                <h1 className="font-display text-3xl text-white">Crea una nueva contraseña</h1>
                <p className="mt-2 text-white/50">
                  Ingresa y confirma tu nueva contraseña para recuperar el acceso.
                </p>
              </div>
              <ResetPasswordForm />
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-blue-900 to-black relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="relative z-10 max-w-md px-12 text-center">
          <AnimatedSection delay={200}>
            <div className="mb-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-black shadow-xl shadow-white/20">
                V
              </div>
            </div>
            <h2 className="font-display text-3xl text-white">Casi listo</h2>
            <p className="mt-4 text-lg text-white/50">
              Define una contraseña segura y vuelve a tu panel de ventas.
            </p>
          </AnimatedSection>
        </div>
      </div>
    </main>
  );
}
