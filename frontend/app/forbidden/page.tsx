import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef]">
      <div className="text-center max-w-md px-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="size-10 text-red-500" />
        </div>
        <h1 className="mt-6 font-display text-4xl text-foreground">Acceso denegado</h1>
        <p className="mt-3 text-foreground/60 leading-relaxed">
          No tienes los permisos necesarios para acceder a esta página.
          Si crees que esto es un error, contacta con el administrador del sistema.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:bg-foreground/90"
          >
            Volver al inicio
          </Link>
          <Link
            href="/sign-in"
            className="rounded-2xl border border-foreground/20 px-6 py-3 text-sm font-medium transition hover:bg-foreground/5"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
