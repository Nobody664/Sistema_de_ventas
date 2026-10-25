"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, TicketPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type { SupportConversation, SupportMessage } from "@/types/support";

export function SupportChatView({
  conversation,
}: {
  conversation: SupportConversation;
}) {
  const addToast = useUiStore((state) => state.addToast);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);

  const {
    data: messages = [],
    isPending: loading,
    error,
    isFetching,
    refetch: loadMessages,
  } = useQuery({
    queryKey: ["support-messages", conversation.id],
    queryFn: () =>
      apiFetch<SupportMessage[]>(
        `/support/chat/conversations/${conversation.id}/messages`,
        { token: getAccessToken() },
      ),
    refetchInterval: 7000,
  });

  useEffect(() => {
    if (followLatest.current)
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const submittedText = text;
    setSending(true);
    try {
      await apiFetch(
        `/support/chat/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({ content: submittedText.trim() }),
        },
      );
      setText((current) => (current === submittedText ? "" : current));
      await loadMessages();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSending(false);
    }
  };

  const convertToTicket = async () => {
    try {
      const ticket = await apiFetch<{ id: string }>(
        `/support/chat/conversations/${conversation.id}/convert-to-ticket`,
        { method: "POST", token: getAccessToken() },
      );
      addToast("Ticket creado desde la conversación", "success");
      window.location.href = `/support/tickets/${ticket.id}`;
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error", "error");
    }
  };

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-foreground/10 bg-card">
      <div className="flex items-center justify-between border-b border-foreground/10 p-4">
        <div>
          <p className="font-medium">
            {conversation.subject ?? "Conversación de soporte"}
          </p>
          <p className="text-xs text-foreground/50">
            {conversation.status === "OPEN" ? "Abierta" : conversation.status}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={convertToTicket}
          className="h-9 rounded-xl text-xs"
        >
          <TicketPlus className="mr-2 size-4" />
          Convertir a ticket
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {messages.length} mensajes cargados
      </p>
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4"
        onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/30 p-3 text-sm"
          >
            <p>
              {messages.length
                ? "Sin sincronizar. Se conservan los últimos mensajes cargados."
                : "No se pudieron cargar los mensajes."}{" "}
              {error.message}
            </p>
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => void loadMessages()}
              className="mt-2"
            >
              Reintentar
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-foreground/40" />
          </div>
        ) : messages.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-foreground/50">
            No hay mensajes aún.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-2xl bg-foreground/5 p-3 text-sm"
            >
              <p className="text-xs text-foreground/50">
                {message.sender?.fullName ?? "Sistema"} ·{" "}
                {new Date(message.createdAt).toLocaleTimeString("es-PE")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-3 border-t border-foreground/10 p-4"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
          aria-label="Mensaje de soporte"
          className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
        />
        <Button
          type="submit"
          aria-label="Enviar mensaje"
          disabled={sending || !text.trim()}
          className="h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-5 font-semibold text-white"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
