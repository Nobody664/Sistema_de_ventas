"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { storeButton, storeInput } from "./store-ui";
import { StoreAdminCommerce } from "./store-admin-commerce";
import { StoreAdminOrders } from "./store-admin-orders";
import { StoreAdminCustomers } from "./store-admin-customers";

export function StoreAdmin() {
  const [settings, setSettings] = useState<{
    slug: string;
    title?: string;
    description?: string;
    enabled: boolean;
    registrationEnabled: boolean;
  } | null>(null);
  const [products, setProducts] = useState<
    { id: string; name: string; storeVisible: boolean }[]
  >([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiFetch<typeof settings>("/store-admin/settings"),
        apiFetch<typeof products>(
          `/store-admin/products?limit=30&page=${page}&search=${encodeURIComponent(search)}`,
        ),
      ]);
      setSettings(s);
      setProducts(p);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo cargar la tienda",
      );
    }
  }, [page, search]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/store-admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          enabled: data.get("enabled") === "on",
          registrationEnabled: data.get("registrationEnabled") === "on",
        }),
      });
      await load();
      setMessage("Configuración guardada");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };
  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-800">
          Canal comercial
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          Tu tienda virtual
        </h1>
        <p className="mt-2 text-stone-500">
          Publica tu selección y atiende a tus clientes.
        </p>
      </div>
      {message && (
        <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-950">
          {message}
        </p>
      )}
      {settings && (
        <form
          key={JSON.stringify(settings)}
          onSubmit={(event) => void save(event)}
          className="space-y-4 rounded-2xl border bg-white p-6"
        >
          <label className="block text-sm">
            Nombre comercial
            <input
              name="title"
              className={storeInput}
              defaultValue={settings.title ?? ""}
              maxLength={100}
            />
          </label>
          <label className="block text-sm">
            Descripción
            <textarea
              name="description"
              className={storeInput}
              defaultValue={settings.description ?? ""}
              maxLength={1000}
            />
          </label>
          <label className="flex gap-2">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={settings.enabled}
            />
            Tienda habilitada (incluida con suscripción vigente y pago
            confirmado)
          </label>
          <label className="flex gap-2">
            <input
              name="registrationEnabled"
              type="checkbox"
              defaultChecked={settings.registrationEnabled}
            />
            Permitir registro de clientes
          </label>
          <div className="flex flex-wrap gap-4">
            <button className={storeButton}>Guardar configuración</button>
            <Link
              href={`/tienda/${settings.slug}/catalogo`}
              target="_blank"
              className="py-3 font-semibold text-teal-900"
            >
              Abrir tienda ↗
            </Link>
          </div>
        </form>
      )}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-display text-xl font-bold">Productos publicados</h2>
        <input
          aria-label="Buscar productos para publicar"
          className={`${storeInput} my-4`}
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Buscar producto"
        />
        <div className="divide-y">
          {products.map((product) => (
            <label
              key={product.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              {product.name}
              <input
                type="checkbox"
                aria-label={`Publicar ${product.name}`}
                checked={product.storeVisible}
                onChange={(event) =>
                  void apiFetch(`/store-admin/products/${product.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ visible: event.target.checked }),
                  })
                    .then(load)
                    .catch((error: Error) => setMessage(error.message))
                }
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>Página {page}</span>
          <button
            disabled={products.length < 30}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
      <StoreAdminCommerce />
      <StoreAdminOrders />
      <StoreAdminCustomers />
    </div>
  );
}
