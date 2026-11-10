"use client";

import type { ReactNode } from "react";
import { orderLabels } from "@/components/store/store-orders";
import { useCommerceContext } from "./commerce-shell";

export const commerceInput =
  "w-full min-w-0 rounded-xl border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
export const commerceButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-background px-4 py-2 text-sm font-semibold transition hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50";
export const commercePrimary = `${commerceButton} !border-primary !bg-primary !text-primary-foreground`;

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-foreground/10 bg-card p-5 md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
        Centro de tienda
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/60">
        {description}
      </p>
    </div>
  );
}
export function QueryState({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-400/40 bg-red-400/5 p-4 text-sm"
      >
        <p>{error.message}</p>
        <button className={`${commerceButton} mt-3`} onClick={retry}>
          Reintentar
        </button>
      </div>
    );
  if (pending)
    return (
      <p role="status" className="rounded-xl bg-foreground/5 p-5 text-sm">
        Cargando datos…
      </p>
    );
  return null;
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${value === "REJECTED" ? "bg-red-500/10 text-red-700 dark:text-red-300" : ["PAID", "COMPLETED", "ACTIVE", "DELIVERED"].includes(value) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ["UNDER_REVIEW", "REVIEW_REQUIRED", "SUSPENDED"].includes(value) ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-foreground/5 text-foreground/65"}`}
    >
      {orderLabels[value] ??
        (
          {
            ACTIVE: "Activa",
            SUSPENDED: "Suspendida",
            PENDING_VERIFICATION: "Por verificar",
            CLOSED: "Cerrada",
          } as Record<string, string>
        )[value] ??
        value}
    </span>
  );
}
export function Money({ value }: { value: string }) {
  const { context } = useCommerceContext();
  return (
    <span className="tabular-nums">
      {new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: context.company.currency,
      }).format(Number(value))}
    </span>
  );
}
export function DateLabel({ value }: { value: string }) {
  const { context } = useCommerceContext();
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("es-PE", {
        timeZone: context.company.timezone,
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))}
    </time>
  );
}
