"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

export function SupportConversationForm() {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();

    try {
      const conversation = await apiFetch<{ id: string }>(
        "/support/chat/conversations",
        {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({ subject }),
        },
      );
      if (message) {
        await apiFetch(
          `/support/chat/conversations/${conversation.id}/messages`,
          {
            method: "POST",
            token: getAccessToken(),
            body: JSON.stringify({ content: message }),
          },
        );
      }
      addToast("Conversación iniciada", "success");
      router.push(`/support/chat/${conversation.id}`);
      router.refresh();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <button
        onClick={() => router.push("/support/chat")}
        className="text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        ← Volver a conversaciones
      </button>

      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg shadow-blue-500/20">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Nueva conversación
          </h1>
          <p className="text-sm text-foreground/50">
            Inicia un chat con el equipo de soporte
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-6 rounded-2xl border border-foreground/10 bg-card p-6 md:p-8">
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-semibold">
              Asunto
            </Label>
            <Input
              id="subject"
              name="subject"
              placeholder="¿En qué podemos ayudarte?"
              maxLength={200}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-semibold">
              Mensaje
            </Label>
            <textarea
              id="message"
              name="message"
              rows={5}
              maxLength={5000}
              placeholder="Escribe tu primer mensaje..."
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 font-semibold text-white shadow-lg shadow-blue-500/25"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Iniciar conversación
          </Button>
        </div>
      </form>
    </div>
  );
}
