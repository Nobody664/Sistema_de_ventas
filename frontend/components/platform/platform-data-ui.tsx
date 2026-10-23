import type { ReactNode } from "react";

export const fieldClass =
  "w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export function money(value: number, currency = "PEN"): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    value,
  );
}

export function DataState({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  children?: ReactNode;
}) {
  if (loading)
    return (
      <p
        role="status"
        className="animate-pulse py-10 text-center text-foreground/60"
      >
        Cargando información…
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400"
      >
        {error.message}
      </p>
    );
  if (empty)
    return (
      <p className="py-10 text-center text-sm text-foreground/50">
        Todavía no hay registros para este filtro.
      </p>
    );
  return <>{children}</>;
}

export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-foreground/10 bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
        {label}
      </p>
      <p className="mt-3 break-words font-display text-3xl tabular-nums">
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-foreground/50">{note}</p>}
    </div>
  );
}
