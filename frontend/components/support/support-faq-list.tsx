"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CreditCard,
  Handshake,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Package,
  Rocket,
  Search,
  SearchX,
  ShoppingCart,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { SupportFaq } from "@/types/support";

interface CategoryMeta {
  icon: LucideIcon;
  chip: string;
  iconBg: string;
  accent: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "Primeros pasos": {
    icon: Rocket,
    chip: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 data-[active=true]:border-sky-500 data-[active=true]:bg-sky-500 data-[active=true]:text-white",
    iconBg: "bg-sky-500/15 text-sky-600",
    accent: "before:bg-sky-500",
  },
  Ventas: {
    icon: ShoppingCart,
    chip: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 data-[active=true]:border-orange-500 data-[active=true]:bg-orange-500 data-[active=true]:text-white",
    iconBg: "bg-orange-500/15 text-orange-600",
    accent: "before:bg-orange-500",
  },
  Inventario: {
    icon: Package,
    chip: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 data-[active=true]:border-blue-500 data-[active=true]:bg-blue-500 data-[active=true]:text-white",
    iconBg: "bg-blue-500/15 text-blue-600",
    accent: "before:bg-blue-500",
  },
  Distribuidores: {
    icon: Handshake,
    chip: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 data-[active=true]:border-amber-500 data-[active=true]:bg-amber-500 data-[active=true]:text-white",
    iconBg: "bg-amber-500/15 text-amber-600",
    accent: "before:bg-amber-500",
  },
  Compras: {
    icon: Truck,
    chip: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 data-[active=true]:border-violet-500 data-[active=true]:bg-violet-500 data-[active=true]:text-white",
    iconBg: "bg-violet-500/15 text-violet-600",
    accent: "before:bg-violet-500",
  },
  Finanzas: {
    icon: Wallet,
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-500 data-[active=true]:text-white",
    iconBg: "bg-emerald-500/15 text-emerald-600",
    accent: "before:bg-emerald-500",
  },
  "Cuenta y plan": {
    icon: CreditCard,
    chip: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 data-[active=true]:border-rose-500 data-[active=true]:bg-rose-500 data-[active=true]:text-white",
    iconBg: "bg-rose-500/15 text-rose-600",
    accent: "before:bg-rose-500",
  },
  Soporte: {
    icon: LifeBuoy,
    chip: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 data-[active=true]:border-teal-500 data-[active=true]:bg-teal-500 data-[active=true]:text-white",
    iconBg: "bg-teal-500/15 text-teal-600",
    accent: "before:bg-teal-500",
  },
};

const FALLBACK_META: CategoryMeta = {
  icon: BookOpen,
  chip: "border-foreground/15 bg-foreground/5 text-foreground/70 hover:bg-foreground/10 data-[active=true]:border-foreground data-[active=true]:bg-foreground data-[active=true]:text-background",
  iconBg: "bg-foreground/10 text-foreground/60",
  accent: "before:bg-foreground/40",
};

function metaFor(category: string | null): CategoryMeta {
  if (!category) return FALLBACK_META;
  return CATEGORY_META[category] ?? FALLBACK_META;
}

function matches(faq: SupportFaq, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    faq.question.toLowerCase().includes(q) ||
    faq.answer.toLowerCase().includes(q) ||
    (faq.category?.toLowerCase().includes(q) ?? false) ||
    faq.keywords.some((keyword) => keyword.toLowerCase().includes(q))
  );
}

export function SupportFaqList({ faqs }: { faqs: SupportFaq[] }) {
  const addToast = useUiStore((state) => state.addToast);
  const [items, setItems] = useState(faqs);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const faq of items) {
      if (!faq.category) continue;
      map.set(faq.category, (map.get(faq.category) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(
      (faq) => matches(faq, query) && (!category || faq.category === category),
    );
  }, [items, query, category]);

  const popular = useMemo(
    () =>
      [...items]
        .sort(
          (a, b) =>
            b.viewCount +
            b.helpfulCount * 2 -
            (a.viewCount + a.helpfulCount * 2),
        )
        .slice(0, 4),
    [items],
  );

  const openFromSidebar = (faq: SupportFaq) => {
    setQuery("");
    setCategory(faq.category);
    setOpenId(faq.id);
    window.setTimeout(() => {
      document
        .getElementById(`faq-${faq.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const vote = async (faqId: string, helpful: boolean) => {
    if (voted[faqId] || votingId) return;
    setVotingId(faqId);
    try {
      await apiFetch(`/support/faqs/${faqId}/feedback`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ helpful }),
      });
      setVoted((prev) => ({ ...prev, [faqId]: true }));
      setItems((prev) =>
        prev.map((faq) =>
          faq.id === faqId
            ? {
                ...faq,
                helpfulCount: faq.helpfulCount + (helpful ? 1 : 0),
                notHelpfulCount: faq.notHelpfulCount + (helpful ? 0 : 1),
              }
            : faq,
        ),
      );
      addToast("¡Gracias por tu opinión!", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por tema, producto o palabra clave..."
            className="h-13 w-full rounded-2xl border border-input bg-background py-3.5 pl-11 pr-11 text-sm shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            aria-label="Buscar en preguntas frecuentes"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition hover:bg-foreground/5 hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-active={category === null}
            onClick={() => setCategory(null)}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3.5 py-1.5 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10 data-[active=true]:border-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
          >
            Todas
            <span className="rounded-full bg-white/25 px-1.5 text-[11px]">
              {items.length}
            </span>
          </button>
          {categories.map((cat) => {
            const meta = metaFor(cat.name);
            const Icon = meta.icon;
            return (
              <button
                key={cat.name}
                type="button"
                data-active={category === cat.name}
                onClick={() =>
                  setCategory(category === cat.name ? null : cat.name)
                }
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${meta.chip}`}
              >
                <Icon className="size-3.5" />
                {cat.name}
                <span className="text-[11px] opacity-70">{cat.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-1 text-xs text-foreground/45">
          <span>
            {filtered.length} {filtered.length === 1 ? "pregunta" : "preguntas"}
            {category ? ` en ${category}` : ""}
            {query ? ` para “${query.trim()}”` : ""}
          </span>
          {(category || query) && (
            <button
              type="button"
              onClick={() => {
                setCategory(null);
                setQuery("");
              }}
              className="font-medium text-emerald-600 transition hover:text-emerald-700"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-foreground/15 bg-white/70 px-6 py-14 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40">
              <SearchX className="size-6" />
            </div>
            <p className="mt-4 font-display text-xl">
              No encontramos resultados
            </p>
            <p className="mt-1 text-sm text-foreground/50">
              Prueba con otra palabra o escríbenos directamente.
            </p>
            <Link
              href="/support/chat"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <MessageSquare className="size-4" />
              Chatear con soporte
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((faq, index) => {
              const open = openId === faq.id;
              const meta = metaFor(faq.category);
              const Icon = meta.icon;
              const isVoting = votingId === faq.id;
              return (
                <div
                  key={faq.id}
                  id={`faq-${faq.id}`}
                  className={`group relative overflow-hidden rounded-2xl border bg-white/85 transition-all duration-300 before:absolute before:inset-y-0 before:left-0 before:w-1 before:transition-opacity ${
                    open
                      ? `border-foreground/15 shadow-lg shadow-foreground/5 ${meta.accent}`
                      : "border-foreground/10 hover:border-foreground/20 hover:shadow-md hover:shadow-foreground/5 before:opacity-0 hover:before:opacity-100"
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : faq.id)}
                    className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                    aria-expanded={open}
                    aria-controls={`faq-answer-${faq.id}`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      {faq.category && (
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/40">
                          {faq.category}
                        </span>
                      )}
                      <span className="block font-medium leading-snug">
                        {faq.question}
                      </span>
                    </span>
                    <ChevronDown
                      className={`size-5 shrink-0 text-foreground/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      open
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div
                        id={`faq-answer-${faq.id}`}
                        className="border-t border-foreground/10 px-4 pb-5 pt-4 sm:px-5"
                      >
                        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/70">
                          {faq.answer}
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <span className="text-xs text-foreground/40">
                            ¿Te fue útil?
                          </span>
                          <button
                            type="button"
                            onClick={() => vote(faq.id, true)}
                            disabled={Boolean(voted[faq.id]) || isVoting}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ThumbsUp className="size-3.5" />
                            Sí ({faq.helpfulCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => vote(faq.id, false)}
                            disabled={Boolean(voted[faq.id]) || isVoting}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ThumbsDown className="size-3.5" />
                            No ({faq.notHelpfulCount})
                          </button>
                          {isVoting && (
                            <Loader2 className="size-3.5 animate-spin text-foreground/40" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-white/20">
            <LifeBuoy className="size-5" />
          </div>
          <h2 className="mt-4 font-display text-xl leading-tight">
            ¿No encontraste tu respuesta?
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Nuestro equipo puede ayudarte con tu caso específico.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href="/support/chat"
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-white/90"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                Chatear ahora
              </span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/support/tickets/new"
              className="flex items-center justify-between gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/25"
            >
              <span className="flex items-center gap-2">
                <Ticket className="size-4" />
                Crear un ticket
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {popular.length > 0 && (
          <div className="rounded-3xl border border-foreground/10 bg-white/85 p-5">
            <h3 className="font-display text-base">Más consultadas</h3>
            <div className="mt-3 space-y-1">
              {popular.map((faq) => {
                const meta = metaFor(faq.category);
                const Icon = meta.icon;
                return (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => openFromSidebar(faq)}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-foreground/5"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-foreground/40" />
                    <span className="line-clamp-2 text-sm text-foreground/70">
                      {faq.question}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-foreground/10 bg-white/85 p-5">
          <h3 className="font-display text-base">Atajos útiles</h3>
          <div className="mt-3 space-y-1.5 text-sm">
            <Link
              href="/support/tickets"
              className="flex items-center justify-between rounded-xl px-2 py-2 text-foreground/70 transition hover:bg-foreground/5"
            >
              Mis tickets
              <ArrowRight className="size-4 text-foreground/30" />
            </Link>
            <Link
              href="/support/chat"
              className="flex items-center justify-between rounded-xl px-2 py-2 text-foreground/70 transition hover:bg-foreground/5"
            >
              Conversaciones
              <ArrowRight className="size-4 text-foreground/30" />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-between rounded-xl px-2 py-2 text-foreground/70 transition hover:bg-foreground/5"
            >
              Ir al dashboard
              <ArrowRight className="size-4 text-foreground/30" />
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
