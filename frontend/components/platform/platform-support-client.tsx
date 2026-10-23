"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Ticket, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";
import type {
  PaginatedSupportTickets,
  PaginatedSupportConversations,
  SupportTicketDetail,
  SupportConversation,
  SupportMessage,
  SupportUserRef,
} from "@/types/support";
import { TICKET_STATUS_LABELS } from "@/types/support";
import { DataState, Field, fieldClass } from "./platform-data-ui";

type Kind = "tickets" | "chat";

export function PlatformSupportClient({
  userId,
  initialTicket,
  initialChat,
}: {
  userId: string;
  initialTicket?: string;
  initialChat?: string;
}) {
  const [kind, setKind] = useState<Kind>(initialChat ? "chat" : "tickets");
  const [assignment, setAssignment] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(
    initialChat ?? initialTicket ?? null,
  );
  const tickets = useQuery({
    queryKey: ["platform-support", "tickets", assignment, page],
    queryFn: () =>
      apiFetch<PaginatedSupportTickets>(
        `/platform/support/tickets?assignment=${assignment}&page=${page}`,
      ),
    enabled: kind === "tickets",
    refetchInterval: 15000,
  });
  const chats = useQuery({
    queryKey: ["platform-support", "chat", assignment, page],
    queryFn: () =>
      apiFetch<PaginatedSupportConversations>(
        `/platform/support/chat?assignment=${assignment}&page=${page}`,
      ),
    enabled: kind === "chat",
    refetchInterval: 15000,
  });
  const loading = kind === "tickets" ? tickets.isLoading : chats.isLoading;
  const error = kind === "tickets" ? tickets.error : chats.error;
  const rows = kind === "tickets" ? tickets.data?.data : chats.data?.data;
  const total =
    (kind === "tickets" ? tickets.data?.total : chats.data?.total) ?? 0;
  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="border-b border-foreground/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
          Control de plataforma / Soporte
        </p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">
          Una bandeja. Todas las empresas.
        </h1>
        <p className="mt-3 text-sm text-foreground/60">
          Asigna responsables y responde tickets o chats sin cambiar de empresa.
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant={kind === "tickets" ? "default" : "outline"}
            onClick={() => {
              setKind("tickets");
              setPage(1);
              setSelected(null);
            }}
          >
            <Ticket className="mr-2 size-4" />
            Tickets
          </Button>
          <Button
            variant={kind === "chat" ? "default" : "outline"}
            onClick={() => {
              setKind("chat");
              setPage(1);
              setSelected(null);
            }}
          >
            <MessageSquare className="mr-2 size-4" />
            Chats
          </Button>
        </div>
        <select
          aria-label="Filtrar por asignación"
          className={fieldClass + " !w-auto"}
          value={assignment}
          onChange={(e) => {
            setAssignment(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Todos</option>
          <option value="unassigned">Sin asignar</option>
          <option value="mine">Asignados a mí</option>
        </select>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-3xl border border-foreground/10 bg-card p-4">
          <p className="mb-4 px-2 text-xs text-foreground/50">
            {total} registros · actualización cada 15 segundos
          </p>
          <DataState loading={loading} error={error} empty={!rows?.length}>
            <div className="space-y-2">
              {rows?.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition hover:border-violet-500/50 ${selected === entry.id ? "border-violet-500/50 bg-violet-500/10" : "border-foreground/10"}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="truncate text-xs text-foreground/50">
                      {entry.company?.name ?? "Plataforma"}
                    </span>
                    <span className="shrink-0 text-[10px] text-violet-500">
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-2 break-words font-medium">
                    {"title" in entry
                      ? entry.title
                      : (entry.subject ?? "Conversación de soporte")}
                  </p>
                  <p className="mt-3 flex items-center gap-1 text-xs text-foreground/50">
                    <UserRound className="size-3" />
                    {entry.assignedTo?.fullName ?? "Sin asignar"}
                  </p>
                </button>
              ))}
            </div>
          </DataState>
          {total > 20 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs">
                {page} / {Math.ceil(total / 20)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 20 >= total}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </section>
        {selected ? (
          <SupportDetail
            key={`${kind}-${selected}`}
            kind={kind}
            id={selected}
            userId={userId}
          />
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-foreground/15 p-8 text-center">
            <MessageSquare className="size-9 text-violet-500/50" />
            <h2 className="mt-4 font-display text-2xl">
              Atención con contexto
            </h2>
            <p className="mt-2 max-w-xs text-sm text-foreground/50">
              Selecciona una solicitud para ver el historial, asignarla y
              responder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SupportDetail({
  kind,
  id,
  userId,
}: {
  kind: Kind;
  id: string;
  userId: string;
}) {
  const cache = useQueryClient();
  const toast = useUiStore((state) => state.addToast);
  const [content, setContent] = useState("");
  const [internal, setInternal] = useState(false);
  const ticket = useQuery({
    queryKey: ["platform-support", "ticket-detail", id],
    queryFn: () =>
      apiFetch<SupportTicketDetail>(`/platform/support/tickets/${id}`),
    enabled: kind === "tickets",
    refetchInterval: 10000,
  });
  const chat = useQuery({
    queryKey: ["platform-support", "chat-detail", id],
    queryFn: () =>
      apiFetch<SupportConversation>(`/platform/support/chat/${id}`),
    enabled: kind === "chat",
    refetchInterval: 10000,
  });
  const messages = useQuery({
    queryKey: ["platform-support", "messages", id],
    queryFn: () =>
      apiFetch<SupportMessage[]>(`/platform/support/chat/${id}/messages`),
    enabled: kind === "chat",
    refetchInterval: 10000,
  });
  const agents = useQuery({
    queryKey: ["platform-support", "agents"],
    queryFn: () => apiFetch<SupportUserRef[]>("/platform/support/agents"),
  });
  const mutate = useMutation({
    mutationFn: ({
      action,
      body,
      method = "PATCH",
    }: {
      action: string;
      body: Record<string, unknown>;
      method?: string;
    }) =>
      apiFetch(`/platform/support/${kind}/${id}/${action}`, {
        method,
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      cache.invalidateQueries({ queryKey: ["platform-support"] });
      if (variables.method === "POST") setContent("");
      toast("Actualizado correctamente", "success");
    },
    onError: (error) => toast(error.message, "error"),
  });
  const detail = kind === "tickets" ? ticket.data : chat.data;
  const entries =
    kind === "tickets"
      ? ticket.data?.comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          author: comment.author?.fullName,
          internal: comment.isInternal,
          createdAt: comment.createdAt,
        }))
      : messages.data?.map((message) => ({
          id: message.id,
          content: message.content,
          author: message.sender?.fullName,
          internal: false,
          createdAt: message.createdAt,
        }));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (content.trim())
      mutate.mutate({
        action: kind === "tickets" ? "comments" : "messages",
        method: "POST",
        body:
          kind === "tickets"
            ? { content: content.trim(), isInternal: internal }
            : { content: content.trim() },
      });
  }
  return (
    <section className="min-w-0 rounded-3xl border border-foreground/10 bg-card p-5 md:p-6">
      <DataState
        loading={kind === "tickets" ? ticket.isLoading : chat.isLoading}
        error={ticket.error ?? chat.error}
      >
        {detail && (
          <>
            <p className="text-xs text-violet-500">
              {detail.company?.name ?? "Plataforma"}
            </p>
            <h2 className="mt-2 break-words font-display text-2xl">
              {"title" in detail ? detail.title : (detail.subject ?? "Soporte")}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Responsable">
                <select
                  className={fieldClass}
                  value={detail.assignedToId ?? ""}
                  disabled={
                    mutate.isPending || agents.isLoading || agents.isError
                  }
                  onChange={(e) =>
                    mutate.mutate({
                      action: "assign",
                      body: { assignedToId: e.target.value || null },
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  {agents.data?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName}
                      {agent.id === userId && " (yo)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estado">
                <select
                  className={fieldClass}
                  value={detail.status}
                  disabled={mutate.isPending}
                  onChange={(e) =>
                    mutate.mutate({
                      action: "status",
                      body: { status: e.target.value },
                    })
                  }
                >
                  {(kind === "tickets"
                    ? Object.entries(TICKET_STATUS_LABELS)
                    : [
                        ["OPEN", "Abierto"],
                        ["PENDING", "Pendiente"],
                        ["CLOSED", "Cerrado"],
                      ]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {agents.error && (
              <p role="alert" className="mt-2 text-sm text-red-500">
                No se pudieron cargar los agentes: {agents.error.message}
              </p>
            )}
            {"description" in detail && (
              <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-foreground/5 p-4 text-sm leading-relaxed">
                {detail.description}
              </p>
            )}
            <div
              className="mt-5 max-h-[420px] space-y-3 overflow-y-auto"
              aria-live="polite"
            >
              <DataState
                loading={kind === "chat" && messages.isLoading}
                error={messages.error}
                empty={!entries?.length}
              >
                {entries?.map((entry) => (
                  <article
                    key={entry.id}
                    className={`rounded-2xl border p-4 ${entry.internal ? "border-orange-500/20 bg-orange-500/5" : "border-foreground/10"}`}
                  >
                    <p className="text-xs text-foreground/50">
                      {entry.author ?? "Sistema"} ·{" "}
                      {new Date(entry.createdAt).toLocaleString("es-PE")}
                      {entry.internal && " · Nota interna"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {entry.content}
                    </p>
                  </article>
                ))}
              </DataState>
            </div>
            <form className="mt-5 grid gap-3" onSubmit={submit}>
              <Field label="Respuesta">
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  className={fieldClass}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe una respuesta a la empresa…"
                />
              </Field>
              {kind === "tickets" && (
                <label className="flex items-center gap-2 text-xs text-foreground/60">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  Nota interna (visible solo para plataforma)
                </label>
              )}
              <Button
                type="submit"
                disabled={mutate.isPending || !content.trim()}
              >
                <Send className="mr-2 size-4" />
                {mutate.isPending ? "Enviando…" : "Enviar respuesta"}
              </Button>
            </form>
          </>
        )}
      </DataState>
    </section>
  );
}
