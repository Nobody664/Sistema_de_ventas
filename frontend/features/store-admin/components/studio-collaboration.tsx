"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { useCommerceContext } from "./commerce-shell";
import { savedStoreDefinition } from "@/lib/store-appearance";
import {
  Panel,
  QueryState,
  DateLabel,
  commerceButton,
  commerceInput,
  commercePrimary,
} from "./commerce-ui";

export function StudioFeatures() {
  const query = useAdminQuery<{
    appearance: boolean;
    notes: boolean;
    savedViews: boolean;
    version: number;
  }>("features");
  const write = useAdminWrite();
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">
        Funciones adicionales
      </h2>
      <p className="my-3 text-sm text-foreground/55">
        Activa cada función por separado. Desactivarla conserva sus datos y
        retira su uso.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <form
          key={query.data.version}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await write
              .mutateAsync({
                resource: "features",
                body: {
                  expectedVersion: query.data!.version ?? 0,
                  appearance: form.get("appearance") === "on",
                  notes: form.get("notes") === "on",
                  savedViews: form.get("savedViews") === "on",
                },
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <fieldset disabled={write.isPending} className="space-y-4">
            {(["appearance", "notes", "savedViews"] as const).map((key) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={query.data?.[key] ?? false}
                />
                {
                  {
                    appearance: "Editor de apariencia",
                    notes: "Notas internas de pedidos",
                    savedViews: "Vistas personales guardadas",
                  }[key]
                }
              </label>
            ))}
            <button className={commercePrimary}>
              {write.isPending ? "Guardando…" : "Guardar funciones"}
            </button>
          </fieldset>
        </form>
      )}
      {write.error && (
        <p role="alert" className="mt-4 text-sm">
          {write.error.message} Recarga la configuración antes de reintentar.
        </p>
      )}
      {write.isSuccess && (
        <p role="status" className="mt-4 text-sm">
          Funciones actualizadas.
        </p>
      )}
    </Panel>
  );
}

export function InternalNotes({ orderId }: { orderId: string }) {
  const { context } = useCommerceContext();
  const enabled = context.extensions?.notes === true;
  const query = useAdminQuery<
    Array<{
      id: string;
      body: string;
      createdAt: string;
      author: { user: { fullName: string | null } };
    }>
  >(`internal-notes/${orderId}`, enabled);
  const write = useAdminWrite();
  const [body, setBody] = useState("");
  if (!enabled) return null;
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">Notas internas</h2>
      <p className="my-3 text-xs text-foreground/55">
        Solo para la administración de esta tienda. No se envían al comprador ni
        modifican su historial.
      </p>
      <form
        data-store-form="NOTE"
        data-store-resource={`internal-notes/${orderId}`}
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await write.mutateAsync({
              resource: `internal-notes/${orderId}`,
              method: "POST",
              body: { body: body.trim() },
            });
            setBody("");
          } catch {
            return;
          }
        }}
      >
        <label className="block text-sm">
          Nueva nota
          <textarea
            className={`${commerceInput} mt-2`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            minLength={1}
            maxLength={2000}
            required
            disabled={write.isPending}
            rows={3}
          />
        </label>
        <button
          className={commerceButton}
          disabled={write.isPending || !body.trim()}
        >
          {write.isPending ? "Guardando…" : "Agregar nota interna"}
        </button>
      </form>
      {write.error && (
        <p role="alert" className="mt-3 text-sm">
          {write.error.message}
        </p>
      )}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <ol className="mt-5 space-y-4">
        {query.data?.map((note) => (
          <li key={note.id} className="rounded-xl bg-foreground/5 p-4">
            <p className="whitespace-pre-wrap break-words text-sm">
              {note.body}
            </p>
            <p className="mt-2 text-xs text-foreground/45">
              {note.author.user.fullName ?? "Administrador"} ·{" "}
              <DateLabel value={note.createdAt} />
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

interface SavedView {
  id: string;
  resource: string;
  name: string;
  definition: Record<string, string>;
  version: number;
  isDefault: boolean;
}
export function SavedStoreViews({
  resource,
}: {
  resource: "ORDERS" | "CATALOG" | "CUSTOMERS";
}) {
  const { context } = useCommerceContext();
  const enabled = context.extensions?.savedViews === true;
  const query = useAdminQuery<SavedView[]>(
    `views?resource=${resource}`,
    enabled,
  );
  const write = useAdminWrite();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [name, setName] = useState("");
  const appliedDefault = useRef(false);
  const apply = (view: SavedView) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(view.definition))
      params.set(key === "layout" ? "view" : key, value);
    router.replace(`${pathname}?${params}`);
  };
  useEffect(() => {
    if (!enabled || appliedDefault.current || !query.data) return;
    appliedDefault.current = true;
    const preferred = query.data.find((view) => view.isDefault);
    if (search.size === 0 && preferred) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(preferred.definition))
        params.set(key === "layout" ? "view" : key, value);
      router.replace(`${pathname}?${params}`);
    }
  }, [enabled, query.data, search, pathname, router]);
  if (!enabled) return null;
  return (
    <Panel>
      <h2 className="font-display text-lg font-semibold">Mis vistas</h2>
      <p className="mt-2 text-xs text-foreground/50">
        Guarda diseño y filtros de estado. Las búsquedas personales, clientes
        concretos y cursores no se guardan.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <div className="my-4 flex flex-wrap gap-3">
        {query.data?.map((view) => (
          <div
            key={view.id}
            className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-foreground/10 p-2"
          >
            <button className={commerceButton} onClick={() => apply(view)}>
              {view.name}
              {view.isDefault ? " · Predeterminada" : ""}
            </button>
            {!view.isDefault && (
              <button
                disabled={write.isPending}
                className="px-2 text-xs underline"
                onClick={() =>
                  void write
                    .mutateAsync({
                      resource: `views/${view.id}`,
                      body: {
                        resource,
                        name: view.name,
                        definition: view.definition,
                        isDefault: true,
                        expectedVersion: view.version,
                      },
                    })
                    .catch(() => undefined)
                }
              >
                Predeterminar
              </button>
            )}
            <button
              disabled={write.isPending}
              aria-label={`Eliminar vista ${view.name}`}
              className="px-2 text-xs underline"
              onClick={() =>
                void write
                  .mutateAsync({
                    resource: `views/${view.id}/delete`,
                    method: "POST",
                    body: { expectedVersion: view.version },
                  })
                  .catch(() => undefined)
              }
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
      <form
        data-store-form="VIEW"
        data-store-resource="views"
        className="flex flex-wrap gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await write.mutateAsync({
              resource: "views",
              method: "POST",
              body: {
                resource,
                name: name.trim(),
                definition: savedStoreDefinition(
                  resource,
                  new URLSearchParams(search.toString()),
                ),
                isDefault: false,
              },
            });
            setName("");
          } catch {
            return;
          }
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Nombre de la vista
          <input
            className={`${commerceInput} mt-2`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <button
          className={`${commerceButton} self-end`}
          disabled={write.isPending || (query.data?.length ?? 0) >= 20}
        >
          Guardar vista actual
        </button>
      </form>
      {write.error && (
        <p role="alert" className="mt-4 text-sm">
          {write.error.message}
        </p>
      )}
    </Panel>
  );
}
