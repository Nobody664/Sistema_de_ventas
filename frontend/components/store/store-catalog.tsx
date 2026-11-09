"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { storeApi } from "@/lib/store-api";
import {
  addStoreQuantity,
  cartQuantity,
  storeQuantity,
  type StoreCart,
} from "@/lib/store-cart";
import { StoreProductImage } from "./store-product-image";
import { storeButton, storeInput, storeMoney } from "./store-ui";
import { AppearanceBanner } from "./appearance-banner";
import type { PublicStoreAppearance } from "@/lib/store-appearance";

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  currency: string;
  availability: string;
  baseUnit: string;
  category?: { id: string; name: string } | null;
  presentations: { id: string; name: string; price: string; factor: string }[];
}

interface CatalogProps {
  appearance?: PublicStoreAppearance | null;
  phone?: string | null;
  slug: string;
  name: string;
  description?: string;
  products: StoreProduct[];
  categories: { id: string; name: string }[];
  categoryId: string;
  search: string;
  query: string;
  page: number;
  pages: number;
  loading: boolean;
  detailId?: string;
  cart: StoreCart | null;
  onCartChange: (cart: StoreCart) => void;
  onMessage: (message: string) => void;
  onSearchChange: (search: string) => void;
  onSearch: () => void;
  onCategoryChange: (id: string) => void;
  onPageChange: (page: number) => void;
}

export function StoreCatalog(props: CatalogProps) {
  const {
    slug,
    name,
    description,
    products,
    categories,
    categoryId,
    search,
    query,
    page,
    pages,
    loading,
    detailId,
    cart,
    onCartChange,
    onMessage,
    onSearchChange,
    onSearch,
    onCategoryChange,
    onPageChange,
  } = props;
  const base = `/tienda/${encodeURIComponent(slug)}`;
  return (
    <section className="store-catalog">
      {props.appearance ? (
        <AppearanceBanner
          appearance={props.appearance}
          name={name}
          phone={props.phone}
        />
      ) : (
        <div className="store-catalog-heading">
          <div>
            <p className="store-eyebrow">El catálogo de {name}</p>
            <h1 className="store-display">
              Encuentra tu
              <br className="hidden sm:block" /> próximo favorito.
            </h1>
            <p className="store-description">
              {description ||
                "Explora, elige y compra a tu ritmo. Nosotros preparamos el resto."}
            </p>
          </div>
          <div className="store-catalog-note">
            <ShoppingBag className="size-5" />
            <p>
              Elige tus productos.
              <br />
              <strong>Tu compra, en un solo lugar.</strong>
            </p>
          </div>
        </div>
      )}
      {detailId ? (
        <Link href={`${base}/catalogo`} className="store-back-link">
          <ArrowLeft className="size-4" />
          Volver al catálogo
        </Link>
      ) : (
        <div className="store-catalog-toolbar">
          <form
            className="store-search"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
            role="search"
          >
            <Search className="size-5 shrink-0" />
            <input
              aria-label="Buscar en catálogo"
              value={search}
              maxLength={160}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="¿Qué estás buscando?"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => onSearchChange("")}
              >
                <X className="size-4" />
              </button>
            )}
            <button className="store-search-submit">Buscar</button>
          </form>
          <label className="store-category-label">
            Categoría
            <select
              aria-label="Categoría del catálogo"
              value={categoryId}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="">Todos los productos</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="store-results-meta">
        <span>
          {detailId
            ? "Detalle del producto"
            : query
              ? `Resultados para “${query}”`
              : categoryId
                ? categories.find((category) => category.id === categoryId)
                    ?.name
                : "Todos los productos"}
        </span>
        <span role="status">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Cargando selección
            </span>
          ) : (
            `${products.length} en esta página`
          )}
        </span>
      </div>
      <div
        className={`store-product-grid ${detailId ? "store-product-grid-detail" : ""}`}
        aria-busy={loading}
      >
        {products.map((product) => (
          <article key={product.id} className="store-product-card">
            <div className="store-product-visual">
              <Link
                href={`${base}/catalogo/${encodeURIComponent(product.id)}`}
                aria-label={`Ver ${product.name}`}
              >
                <StoreProductImage src={product.imageUrl} name={product.name} />
              </Link>
              <span
                className={`store-availability ${product.availability === "AVAILABLE" ? "" : "store-unavailable"}`}
              >
                <span />
                {product.availability === "AVAILABLE"
                  ? "Disponible"
                  : "Agotado"}
              </span>
            </div>
            <div className="store-product-content">
              {product.category && (
                <p className="store-product-category">
                  {product.category.name}
                </p>
              )}
              <h2>
                <Link
                  href={`${base}/catalogo/${encodeURIComponent(product.id)}`}
                >
                  {product.name}
                </Link>
              </h2>
              {detailId && product.description && (
                <p className="store-description">{product.description}</p>
              )}
              <ProductPurchase
                product={product}
                slug={slug}
                cart={cart}
                onCartChange={onCartChange}
                onMessage={onMessage}
              />
            </div>
          </article>
        ))}
      </div>
      {!loading && !products.length && (
        <div className="store-empty-state">
          <Search className="size-8" />
          <h2>No encontramos productos</h2>
          <p>Prueba otro nombre o cambia la categoría.</p>
        </div>
      )}
      {!detailId && (
        <div className="store-pagination">
          <button
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </button>
          <span>
            {page} / {Math.max(1, pages)}
          </span>
          <button
            disabled={loading || page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      {!!cart?.items.length && (
        <div className="store-cart-dock">
          <div>
            <ShoppingBag className="size-5" />
            <p>
              <strong>{storeQuantity(cartQuantity(cart))} en tu carrito</strong>
              <span>{cart.items.length} productos seleccionados</span>
            </p>
          </div>
          <Link href={`${base}/carrito`}>
            Revisar carrito
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

function ProductPurchase({
  product,
  slug,
  cart,
  onCartChange,
  onMessage,
}: {
  product: StoreProduct;
  slug: string;
  cart: StoreCart | null;
  onCartChange: (cart: StoreCart) => void;
  onMessage: (message: string) => void;
}) {
  const [presentationId, setPresentation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [added, setAdded] = useState(false);
  const current = cart?.items.find((line) => line.productId === product.id);
  const presentation = product.presentations.find(
    (item) => item.id === presentationId,
  );
  const price = presentation?.price ?? product.price;
  const step = presentationId || product.baseUnit === "UNIT" ? 1 : 0.001;
  const amount = Number(quantity);
  const valid =
    amount >= step &&
    amount <= 10000 &&
    Number.isFinite(amount) &&
    Math.abs(Math.round(amount * 1000) - amount * 1000) < 0.000001 &&
    (step !== 1 || Number.isInteger(amount));
  const conflict =
    !!current && (current.presentationId ?? "") !== presentationId;
  const change = (value: string) => {
    setQuantity(value);
    setAdded(false);
  };
  const add = async () => {
    if (pending.current || !valid || conflict) return;
    pending.current = true;
    setBusy(true);
    try {
      const latest = await storeApi<StoreCart>(slug, "cart");
      const old = latest.items.find((line) => line.productId === product.id);
      if (old && (old.presentationId ?? "") !== presentationId)
        throw new Error("Retira la presentación actual antes de cambiarla.");
      const total = addStoreQuantity(old?.quantity ?? 0, amount);
      if (total > 10000)
        throw new Error("El carrito admite hasta 10 000 por producto.");
      const updated = await storeApi<StoreCart>(slug, "cart/items", {
        version: latest.version,
        productId: product.id,
        ...(presentationId ? { presentationId } : {}),
        quantity: total,
      });
      onCartChange(updated);
      setAdded(true);
      onMessage("Producto agregado al carrito");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "No se pudo agregar");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="store-product-purchase">
      <div className="store-product-price">
        <strong>{storeMoney(price, product.currency)}</strong>
        <span>
          /{" "}
          {presentation?.name ??
            (product.baseUnit === "UNIT"
              ? "unidad"
              : product.baseUnit.toLowerCase())}
        </span>
      </div>
      {!!product.presentations.length && (
        <label className="store-presentation-label">
          Presentación
          <select
            aria-label={`Presentación de ${product.name}`}
            className={storeInput}
            disabled={busy}
            value={presentationId}
            onChange={(event) => {
              setPresentation(event.target.value);
              change("1");
            }}
          >
            <option value="">Unidad base</option>
            {product.presentations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="store-buy-row">
        <div className="store-quantity-control">
          <button
            type="button"
            aria-label={`Disminuir cantidad de ${product.name}`}
            disabled={busy || amount <= step}
            onClick={() =>
              change(
                String(Math.max(step, addStoreQuantity(amount || step, -step))),
              )
            }
          >
            <Minus className="size-4" />
          </button>
          <input
            aria-label={`Cantidad de ${product.name}`}
            type="number"
            min={step}
            max={10000}
            step={step}
            value={quantity}
            disabled={busy}
            onChange={(event) => change(event.target.value)}
          />
          <button
            type="button"
            aria-label={`Aumentar cantidad de ${product.name}`}
            disabled={busy || amount >= 10000}
            onClick={() => change(String(addStoreQuantity(amount || 0, step)))}
          >
            <Plus className="size-4" />
          </button>
        </div>
        <button
          type="button"
          className={`${storeButton} store-add-button`}
          disabled={
            busy || !valid || conflict || product.availability !== "AVAILABLE"
          }
          onClick={() => void add()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : added ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {busy ? "Agregando…" : added ? "Agregado" : "Agregar"}
        </button>
      </div>
      <div className="store-product-footnote">
        {conflict ? (
          <span className="text-amber-700">
            Retira la presentación actual para cambiarla.
          </span>
        ) : current ? (
          <span>{storeQuantity(current.quantity)} en tu carrito</span>
        ) : (
          <span>Selecciona la cantidad</span>
        )}
        <strong>
          {storeMoney(valid ? amount * Number(price) : 0, product.currency)}
        </strong>
      </div>
    </div>
  );
}
