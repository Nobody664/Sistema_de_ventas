"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { SupportFaq } from "@/types/support";

export function SupportFaqList({ faqs }: { faqs: SupportFaq[] }) {
  const addToast = useUiStore((state) => state.addToast);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [faqs, query]);

  const vote = async (faqId: string, helpful: boolean) => {
    if (voted[faqId]) return;
    try {
      await apiFetch(`/support/faqs/${faqId}/feedback`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ helpful }),
      });
      setVoted((prev) => ({ ...prev, [faqId]: true }));
      addToast("¡Gracias por tu opinión!", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en preguntas frecuentes..."
          className="h-12 w-full rounded-2xl border border-input bg-background pl-11 pr-4 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-foreground/50">
          No se encontraron resultados.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq) => {
            const open = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="overflow-hidden rounded-2xl border border-foreground/10 bg-card"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : faq.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-medium">{faq.question}</span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="border-t border-foreground/10 p-5 text-sm">
                    <p className="whitespace-pre-wrap text-foreground/70">
                      {faq.answer}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-xs text-foreground/40">
                        ¿Te fue útil?
                      </span>
                      <button
                        type="button"
                        onClick={() => vote(faq.id, true)}
                        disabled={voted[faq.id]}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <ThumbsUp className="size-3.5" />
                        Sí ({faq.helpfulCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => vote(faq.id, false)}
                        disabled={voted[faq.id]}
                        className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <ThumbsDown className="size-3.5" />
                        No ({faq.notHelpfulCount})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
