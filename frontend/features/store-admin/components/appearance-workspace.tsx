"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { compressImage } from "@/lib/image-compression";
import {
  appearancePresets,
  type StoreAppearance,
} from "@/lib/store-appearance";
import { AppearanceBanner } from "@/components/store/appearance-banner";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { useCommerceContext } from "./commerce-shell";
import {
  Panel,
  Heading,
  QueryState,
  commerceButton,
  commerceInput,
  commercePrimary,
} from "./commerce-ui";

interface AppearanceState {
  draft: StoreAppearance;
  draftVersion: number;
  publishedVersion: number | null;
  publishedAt?: string | null;
  canRestore?: boolean;
}
interface Media {
  id: string;
  purpose: "LOGO" | "HERO";
  state: string;
  byteSize: number;
  width: number;
  height: number;
}

function MediaLibrary() {
  const query = useAdminQuery<Media[]>("media");
  const write = useAdminWrite();
  const [purpose, setPurpose] = useState("LOGO");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">Medios de marca</h2>
      <p className="my-3 text-xs text-foreground/50">
        PNG, JPEG o WebP. Se validan y recodifican en el servidor; subir una
        imagen no la publica.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Propósito
          <select
            aria-label="Propósito del medio"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            className={`${commerceInput} mt-2`}
          >
            <option value="LOGO">Logo</option>
            <option value="HERO">Portada</option>
          </select>
        </label>
        <label className="text-sm">
          Subir imagen
          <input
            className={`${commerceInput} mt-2`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={processing || write.isPending}
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              setError("");
              setProcessing(true);
              try {
                const image = await compressImage(file, {
                  maxWidth: 1600,
                  maxHeight: 1600,
                  format: "image/webp",
                });
                await write.mutateAsync({
                  resource: "media",
                  method: "POST",
                  body: { purpose, image },
                });
                input.value = "";
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "No se pudo subir la imagen",
                );
              } finally {
                setProcessing(false);
              }
            }}
          />
        </label>
      </div>
      {processing && (
        <p role="status" className="mt-3 text-sm">
          Preparando imagen…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {query.data?.map((media) => (
          <article
            key={media.id}
            className="rounded-xl border border-foreground/10 p-4"
          >
            <Image
              src={`/api/store-admin/media/${media.id}/content`}
              width={160}
              height={100}
              unoptimized
              alt={
                media.purpose === "LOGO" ? "Logo privado" : "Portada privada"
              }
              className="h-24 w-full rounded-lg object-contain"
            />
            <p className="my-3 text-xs">
              {media.purpose === "LOGO" ? "Logo" : "Portada"} · {media.width} ×{" "}
              {media.height} · {media.state}
            </p>
            <button
              className={commerceButton}
              disabled={write.isPending}
              onClick={() =>
                void write
                  .mutateAsync({
                    resource: `media/${media.id}/archive`,
                    method: "POST",
                    body: {},
                  })
                  .catch(() => undefined)
              }
            >
              Archivar medio
            </button>
          </article>
        ))}
      </div>
      {write.error && !processing && (
        <p role="alert" className="mt-3 text-sm">
          {write.error.message}
        </p>
      )}
    </Panel>
  );
}

function SavedPreview() {
  const { context } = useCommerceContext();
  const query = useAdminQuery<AppearanceState>("appearance/preview");
  const draft = query.data?.draft;
  return (
    <Panel>
      <h2 className="mb-4 font-display text-xl font-semibold">
        Vista previa privada del borrador guardado
      </h2>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {draft && (
        <div
          className="store-portal rounded-2xl"
          data-store-theme={draft.themePreset}
        >
          <AppearanceBanner
            name={context.store.title}
            appearance={{
              ...draft,
              logoUrl: draft.logoAssetId
                ? `/api/store-admin/media/${draft.logoAssetId}/content`
                : null,
              coverUrl: draft.coverAssetId
                ? `/api/store-admin/media/${draft.coverAssetId}/content`
                : null,
            }}
          />
        </div>
      )}
    </Panel>
  );
}

function AppearanceEditor({
  initial,
  reload,
}: {
  initial: AppearanceState;
  reload: () => void;
}) {
  const [draft, setDraft] = useState(initial.draft);
  const [saved, setSaved] = useState(initial.draft);
  const [version, setVersion] = useState(initial.draftVersion);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const write = useAdminWrite<AppearanceState>();
  const media = useAdminQuery<Media[]>("media");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = <K extends keyof StoreAppearance>(
    key: K,
    value: StoreAppearance[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-6">
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-foreground/55">
            Borrador v{version} · Publicación{" "}
            {initial.publishedVersion ?? "ninguna"}
          </p>
          <button
            className={commerceButton}
            onClick={reload}
            disabled={write.isPending}
          >
            Recargar borrador
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const result = await write.mutateAsync({
                resource: "appearance",
                body: { expectedDraftVersion: version, draft },
              });
              setVersion(result.draftVersion);
              setSaved(draft);
              setMessage(
                "Borrador guardado. La tienda pública todavía no cambia.",
              );
            } catch {
              setMessage("");
            }
          }}
        >
          <fieldset disabled={write.isPending} className="space-y-4">
            <label className="block text-sm">
              Tema visual
              <select
                aria-label="Tema visual"
                className={`${commerceInput} mt-2`}
                value={draft.themePreset}
                onChange={(event) =>
                  update(
                    "themePreset",
                    event.target.value as StoreAppearance["themePreset"],
                  )
                }
              >
                {Object.entries(appearancePresets).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Titular
              <input
                value={draft.headline}
                onChange={(event) => update("headline", event.target.value)}
                minLength={1}
                maxLength={80}
                required
                className={`${commerceInput} mt-2`}
              />
            </label>
            <label className="block text-sm">
              Descripción de portada
              <textarea
                value={draft.heroDescription}
                onChange={(event) =>
                  update("heroDescription", event.target.value)
                }
                maxLength={240}
                rows={3}
                className={`${commerceInput} mt-2`}
              />
            </label>
            {(["logoAssetId", "coverAssetId"] as const).map((key) => (
              <label key={key} className="block text-sm">
                {key === "logoAssetId"
                  ? "Logo de la tienda"
                  : "Portada de la tienda"}
                <select
                  aria-label={
                    key === "logoAssetId"
                      ? "Logo de la tienda"
                      : "Portada de la tienda"
                  }
                  value={draft[key] ?? ""}
                  onChange={(event) => update(key, event.target.value || null)}
                  className={`${commerceInput} mt-2`}
                >
                  <option value="">Sin imagen</option>
                  {media.data
                    ?.filter(
                      (item) =>
                        item.state === "READY" &&
                        item.purpose ===
                          (key === "logoAssetId" ? "LOGO" : "HERO"),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.purpose} · {item.width}×{item.height} ·{" "}
                        {item.id.slice(-8)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.showDescription}
                onChange={(event) =>
                  update("showDescription", event.target.checked)
                }
              />
              Mostrar descripción
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.showBusinessPhone}
                onChange={(event) =>
                  update("showBusinessPhone", event.target.checked)
                }
              />
              Mostrar teléfono del negocio
            </label>
            <button className={commercePrimary}>Guardar borrador</button>
          </fieldset>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={commerceButton}
            disabled={dirty || write.isPending}
            onClick={() => setPreview((value) => !value)}
          >
            {preview ? "Ocultar vista previa" : "Previsualizar borrador"}
          </button>
          <button
            className={commercePrimary}
            disabled={dirty || write.isPending}
            onClick={async () => {
              try {
                await write.mutateAsync({
                  resource: "appearance/publish",
                  method: "POST",
                  body: {
                    expectedDraftVersion: version,
                    expectedPublishedVersion: initial.publishedVersion,
                  },
                });
                setMessage("Apariencia publicada en la tienda.");
              } catch {
                setMessage("");
              }
            }}
          >
            Publicar apariencia
          </button>
          {initial.canRestore && (
            <button
              className={commerceButton}
              disabled={write.isPending}
              onClick={async () => {
                try {
                  await write.mutateAsync({
                    resource: "appearance/restore",
                    method: "POST",
                    body: { expectedVersion: initial.publishedVersion },
                  });
                  setMessage(
                    "Publicación anterior restaurada. El borrador se conserva.",
                  );
                } catch {
                  setMessage("");
                }
              }}
            >
              Restaurar publicación anterior
            </button>
          )}
        </div>
        {dirty && (
          <p className="mt-3 text-xs text-foreground/50">
            Guarda el borrador antes de previsualizar o publicar.
          </p>
        )}
        {write.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-400/30 p-4 text-sm"
          >
            {write.error.message} Los cambios del formulario se conservan. Si
            hay un conflicto, recarga el borrador para revisar las versiones.
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm">
            {message}
          </p>
        )}
      </Panel>
      {preview && <SavedPreview />}
      <MediaLibrary />
    </div>
  );
}

export function AppearanceWorkspace() {
  const { context } = useCommerceContext();
  const enabled = context.extensions?.appearance === true;
  const query = useAdminQuery<AppearanceState>("appearance", enabled);
  const [generation, setGeneration] = useState(0);
  return (
    <div className="space-y-6">
      <Heading
        title="Apariencia de la tienda"
        description="Trabaja en un borrador privado y publícalo cuando esté listo. Los cambios visuales no modifican pedidos ni cotizaciones."
      />
      {!enabled ? (
        <Panel>
          <p className="text-sm">El editor de apariencia está desactivado.</p>
          <Link
            href="/comercio/configuracion"
            className={`${commerceButton} mt-4`}
          >
            Configurar funciones adicionales
          </Link>
        </Panel>
      ) : (
        <>
          <QueryState
            pending={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          />
          {query.data && (
            <AppearanceEditor
              key={generation}
              initial={query.data}
              reload={() =>
                void query.refetch().then((result) => {
                  if (result.isSuccess) setGeneration((value) => value + 1);
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
