'use client';

import { SignInForm } from '@/components/auth/sign-in-form';
import { AnimatedSection } from '@/components/ui/animations';

export function SignInPageClient() {
  return (
    <main className="flex min-h-screen bg-black">
      {/* Left Side - Form */}
      <div className="flex w-full items-center justify-center px-8 py-12 lg:w-1/2 relative">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-900/20 via-black to-black" />
        <div className="absolute top-20 left-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 w-full max-w-md">
          <AnimatedSection>
            <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 shadow-2xl shadow-black/50">
              <div className="mb-2">
                <h1 className="font-display text-3xl text-white">Bienvenido de nuevo</h1>
                <p className="mt-2 text-white/50">Ingresa a tu cuenta para continuar</p>
              </div>
              <SignInForm />
            </div>
          </AnimatedSection>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-violet-900 to-black relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[120px] animate-pulse" />
        
        <div className="relative z-10 max-w-md px-12 text-center">
          <AnimatedSection delay={200}>
            <div className="mb-8 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-black shadow-xl shadow-white/20">
                V
              </div>
            </div>
            <h2 className="font-display text-3xl text-white">
              Gestiona tu negocio desde cualquier lugar
            </h2>
            <p className="mt-4 text-lg text-white/50">
              Accede a tu panel de ventas, inventario y clientes desde tu computadora o celular.
            </p>
          </AnimatedSection>
          
          <div className="mt-12 space-y-4">
            {[
              ['Seguridad', 'Tus datos están protegidos con encriptación de nivel bancario'],
              ['Velocidad', 'Interfaz diseñada para responder en milisegundos'],
              ['Soporte', 'Equipo peruano dispuesto a ayudarte'],
            ].map(([title, desc], index) => (
              <AnimatedSection key={title} delay={400 + index * 100}>
                <div className="flex items-start gap-4 text-left rounded-xl bg-white/5 p-4 hover:bg-white/10 transition-colors duration-300 cursor-default">
                  <div className="size-2 rounded-full bg-violet-400 mt-2" />
                  <div>
                    <p className="font-medium text-white">{title}</p>
                    <p className="text-sm text-white/50">{desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
