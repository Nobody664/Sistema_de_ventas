"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { validateStoreAdminForm } from "@/lib/store-validation";
import { useAdminQuery, useAdminWrite } from "../api/queries";
import { StudioFeatures } from "./studio-collaboration";
import { ExperienceControl } from "./experience-control";
import {
  commerceButton,
  commercePrimary,
  commerceInput,
  Heading,
  Panel,
  QueryState,
  Money,
} from "./commerce-ui";

type ConfigurationSection = "general" | "pagos" | "entregas" | "reglas";
interface Settings {
  title: string | null;
  description: string | null;
  enabled: boolean;
  registrationEnabled: boolean;
  checkoutEnabled: boolean;
  pricesIncludeTax: boolean;
  taxRate: string;
  reservationMinutes: number;
}
interface PaymentMethod {
  id: string;
  code: string;
  label: string;
  instructions: string;
  enabled: boolean;
}
interface ShippingMethod {
  id: string;
  kind: "PICKUP" | "DELIVERY";
  label: string;
  fee: string;
  districts: string[];
  pickupAddress: string | null;
  enabled: boolean;
}
interface Methods {
  payment: PaymentMethod[];
  shipping: ShippingMethod[];
}
const paymentNames: Record<string, string> = {
  TRANSFER: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
  CASH_ON_PICKUP: "Efectivo al retirar",
  MERCADOPAGO: "Mercado Pago",
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <div className="mt-2">
        {Children.map(children, (child) =>
          isValidElement<{
            id?: string;
            "aria-invalid"?: boolean;
            "aria-describedby"?: string;
          }>(child) &&
          typeof child.type === "string" &&
          ["input", "select", "textarea"].includes(child.type)
            ? cloneElement(child, {
                id,
                "aria-invalid": Boolean(error),
                "aria-describedby": error ? `${id}-error` : undefined,
              })
            : child,
        )}
      </div>
      {error && (
        <span
          id={`${id}-error`}
          className="mt-1 block text-xs text-red-600 dark:text-red-300"
        >
          {error}
        </span>
      )}
    </div>
  );
}

function AdminForm({
  schema,
  resource,
  method = "POST",
  transform,
  children,
  resetOnSuccess = false,
}: {
  schema: string;
  resource: string;
  method?: "POST" | "PATCH";
  transform: (form: FormData) => Record<string, unknown>;
  children: (errors: Record<string, string>) => ReactNode;
  resetOnSuccess?: boolean;
}) {
  const write = useAdminWrite();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  return (
    <form
      data-store-form="CONFIGURATION"
      data-store-resource={resource}
      className="space-y-4"
      aria-busy={write.isPending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (write.isPending) return;
        const form = event.currentTarget;
        const validated = validateStoreAdminForm(
          schema,
          transform(new FormData(form)),
        );
        setErrors(validated.errors);
        setMessage("");
        if (Object.keys(validated.errors).length) {
          const field = form.elements.namedItem(
            Object.keys(validated.errors)[0],
          );
          if (field instanceof HTMLElement) field.focus();
          return;
        }
        try {
          await write.mutateAsync({ resource, method, body: validated.data });
          if (resetOnSuccess) form.reset();
          setMessage(
            "Cambios guardados. Las nuevas cotizaciones usarán esta configuración.",
          );
        } catch {
          setMessage("");
        }
      }}
    >
      <fieldset disabled={write.isPending} className="min-w-0 space-y-4">
        {children(errors)}
        <button className={commercePrimary}>
          {write.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </fieldset>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          Revisa los campos indicados antes de guardar.
        </p>
      )}
      {write.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 p-4 text-sm"
        >
          {write.error.message} Tus datos se conservan para reintentar.
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm">
          {message}
        </p>
      )}
    </form>
  );
}

function PaymentEditor({
  payment,
  availableCodes,
}: {
  payment?: PaymentMethod;
  availableCodes?: string[];
}) {
  return (
    <AdminForm
      schema="payment-methods"
      resource="payment-methods"
      transform={(data) => ({
        code: data.get("code"),
        label: data.get("label"),
        instructions: data.get("instructions"),
        enabled: data.get("enabled") === "on",
      })}
    >
      {(errors) => (
        <>
          {payment ? (
            <input type="hidden" name="code" value={payment.code} />
          ) : (
            <Field label="Tipo de pago" error={errors.code}>
              <select name="code" className={commerceInput}>
                {(availableCodes ?? []).map((code) => (
                  <option key={code} value={code}>
                    {paymentNames[code]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Nombre del pago" error={errors.label}>
            <input
              name="label"
              className={commerceInput}
              defaultValue={payment?.label ?? ""}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field label="Instrucciones de pago" error={errors.instructions}>
            <textarea
              name="instructions"
              className={commerceInput}
              defaultValue={payment?.instructions ?? ""}
              maxLength={2000}
              rows={4}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={payment?.enabled ?? true}
            />
            Disponible en el checkout
          </label>
        </>
      )}
    </AdminForm>
  );
}

function ShippingEditor({ shipping }: { shipping?: ShippingMethod }) {
  const [kind, setKind] = useState<"PICKUP" | "DELIVERY">(
    shipping?.kind ?? "PICKUP",
  );
  return (
    <AdminForm
      schema="shipping-methods"
      resource={
        shipping ? `shipping-methods/${shipping.id}` : "shipping-methods"
      }
      method={shipping ? "PATCH" : "POST"}
      transform={(data) => ({
        kind,
        label: data.get("label"),
        fee: Number(data.get("fee")),
        districts:
          kind === "DELIVERY"
            ? String(data.get("districts") ?? "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        ...(kind === "PICKUP"
          ? { pickupAddress: data.get("pickupAddress") }
          : {}),
        enabled: data.get("enabled") === "on",
      })}
    >
      {(errors) => (
        <>
          <Field label="Tipo de entrega" error={errors.kind}>
            <select
              className={commerceInput}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as "PICKUP" | "DELIVERY")
              }
            >
              <option value="PICKUP">Retiro en tienda</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </Field>
          <Field label="Nombre del envío" error={errors.label}>
            <input
              name="label"
              defaultValue={shipping?.label ?? ""}
              className={commerceInput}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field label="Tarifa de envío" error={errors.fee}>
            <input
              name="fee"
              type="number"
              min={0}
              max={100000}
              step="0.01"
              defaultValue={shipping?.fee ?? "0"}
              required
              className={commerceInput}
            />
          </Field>
          {kind === "PICKUP" ? (
            <Field label="Dirección de retiro" error={errors.pickupAddress}>
              <input
                key="pickup"
                name="pickupAddress"
                defaultValue={shipping?.pickupAddress ?? ""}
                minLength={1}
                maxLength={240}
                required
                className={commerceInput}
              />
            </Field>
          ) : (
            <Field label="Distritos de cobertura" error={errors.districts}>
              <input
                key="districts"
                name="districts"
                defaultValue={shipping?.districts.join(", ") ?? ""}
                maxLength={1399}
                placeholder="150101, 150102"
                required
                className={commerceInput}
              />
              <span className="mt-2 block text-xs font-normal text-foreground/50">
                Ubigeos oficiales de 6 dígitos separados por coma. No se envía
                una dirección de retiro para delivery.
              </span>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={shipping?.enabled ?? true}
            />
            Disponible en el checkout
          </label>
        </>
      )}
    </AdminForm>
  );
}

function GatewayConfiguration() {
  const query = useAdminQuery<{
    configured: boolean;
    merchantId?: string;
    webhookUrl?: string;
    liveMode?: boolean;
  }>("integration");
  return (
    <Panel>
      <h2 className="font-display text-xl font-semibold">
        Integración Mercado Pago
      </h2>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <p className="my-4 text-sm text-foreground/60">
            {query.data.configured
              ? `Comercio verificado: ${query.data.merchantId} · ${query.data.liveMode ? "Producción" : "Pruebas"}`
              : "La pasarela aún no está configurada."}
          </p>
          {query.data.webhookUrl && (
            <p className="mb-5 break-all text-xs">
              Webhook: {query.data.webhookUrl}
            </p>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary">
              Configurar credenciales del comercio
            </summary>
            <div className="mt-5">
              <AdminForm
                schema="integration"
                resource="integration"
                resetOnSuccess
                transform={(data) => ({
                  accessToken: data.get("accessToken"),
                  webhookSecret: data.get("webhookSecret"),
                  liveMode: data.get("liveMode") === "on",
                  enabled: data.get("enabled") === "on",
                })}
              >
                {(errors) => (
                  <>
                    <Field
                      label="Access token del comercio"
                      error={errors.accessToken}
                    >
                      <input
                        type="password"
                        name="accessToken"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={1000}
                        required
                        className={commerceInput}
                      />
                    </Field>
                    <Field
                      label="Secreto de webhook"
                      error={errors.webhookSecret}
                    >
                      <input
                        type="password"
                        name="webhookSecret"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={500}
                        required
                        className={commerceInput}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="liveMode"
                        defaultChecked={query.data?.liveMode ?? false}
                      />
                      Modo producción
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="enabled" defaultChecked />
                      Habilitar integración
                    </label>
                    <p className="text-xs text-foreground/50">
                      Las credenciales guardadas no se recuperan ni se rellenan
                      en este formulario.
                    </p>
                  </>
                )}
              </AdminForm>
            </div>
          </details>
        </>
      )}
    </Panel>
  );
}

export function ConfigurationWorkspace({
  section,
}: {
  section: ConfigurationSection;
}) {
  const settings = useAdminQuery<Settings>(
    "settings",
    section === "general" || section === "reglas",
  );
  const methods = useAdminQuery<Methods>(
    "methods",
    section === "pagos" || section === "entregas",
  );
  const query =
    section === "general" || section === "reglas" ? settings : methods;
  const titles = {
    general: "Configuración de la tienda",
    pagos: "Configuración de pagos",
    entregas: "Configuración de entregas",
    reglas: "Reglas de compra",
  };
  const availableCodes = Object.keys(paymentNames).filter(
    (code) => !methods.data?.payment.some((method) => method.code === code),
  );
  return (
    <div className="space-y-6">
      {section === "general" && <StudioFeatures />}
      {section === "general" && <ExperienceControl />}
      <Heading
        title={titles[section]}
        description="Los cambios se aplican a nuevas cotizaciones. Los pedidos conservan sus métodos, tarifas e instrucciones originales."
      />
      <nav
        aria-label="Secciones de configuración"
        className="flex flex-wrap gap-2"
      >
        {(["general", "pagos", "entregas", "reglas"] as const).map((key) => (
          <Link
            key={key}
            href={
              key === "general"
                ? "/comercio/configuracion"
                : `/comercio/configuracion/${key}`
            }
            aria-current={section === key ? "page" : undefined}
            className={`${commerceButton} ${section === key ? "!border-primary text-primary" : ""}`}
          >
            {key === "general"
              ? "Datos de la tienda"
              : key === "pagos"
                ? "Pagos"
                : key === "entregas"
                  ? "Entregas"
                  : "Reglas"}
          </Link>
        ))}
      </nav>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {section === "general" && settings.data && (
        <Panel>
          <AdminForm
            schema="settings"
            resource="settings"
            method="PATCH"
            transform={(data) => ({
              title: data.get("title"),
              description: data.get("description"),
              enabled: data.get("enabled") === "on",
              registrationEnabled: data.get("registrationEnabled") === "on",
            })}
          >
            {(errors) => (
              <>
                <Field label="Nombre comercial" error={errors.title}>
                  <input
                    name="title"
                    defaultValue={settings.data!.title ?? ""}
                    maxLength={100}
                    className={commerceInput}
                  />
                </Field>
                <Field label="Descripción" error={errors.description}>
                  <textarea
                    name="description"
                    defaultValue={settings.data!.description ?? ""}
                    maxLength={1000}
                    rows={4}
                    className={commerceInput}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={settings.data!.enabled}
                  />
                  Tienda habilitada
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="registrationEnabled"
                    type="checkbox"
                    defaultChecked={settings.data!.registrationEnabled}
                  />
                  Permitir registro de clientes
                </label>
              </>
            )}
          </AdminForm>
        </Panel>
      )}
      {section === "reglas" && settings.data && (
        <Panel>
          <AdminForm
            schema="commerce"
            resource="commerce"
            method="PATCH"
            transform={(data) => ({
              checkoutEnabled: data.get("checkoutEnabled") === "on",
              pricesIncludeTax: data.get("pricesIncludeTax") === "on",
              taxRate: Number(data.get("taxRate")),
              reservationMinutes: Number(data.get("reservationMinutes")),
            })}
          >
            {(errors) => (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="checkoutEnabled"
                    type="checkbox"
                    defaultChecked={settings.data!.checkoutEnabled}
                  />
                  Habilitar compras
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="pricesIncludeTax"
                    type="checkbox"
                    defaultChecked={settings.data!.pricesIncludeTax}
                  />
                  Los precios incluyen impuestos
                </label>
                <Field label="Impuesto (%)" error={errors.taxRate}>
                  <input
                    name="taxRate"
                    type="number"
                    defaultValue={settings.data!.taxRate}
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    className={commerceInput}
                  />
                </Field>
                <Field
                  label="Reserva (minutos)"
                  error={errors.reservationMinutes}
                >
                  <input
                    name="reservationMinutes"
                    type="number"
                    defaultValue={settings.data!.reservationMinutes}
                    min={5}
                    max={1440}
                    step={1}
                    required
                    className={commerceInput}
                  />
                </Field>
              </>
            )}
          </AdminForm>
        </Panel>
      )}
      {section === "pagos" && methods.data && (
        <>
          <h2 className="font-display text-xl font-semibold">
            Métodos configurados
          </h2>
          <p className="text-xs text-foreground/50">
            Se muestran por nombre, en el mismo orden que el checkout.
          </p>
          {methods.data.payment.length === 0 && (
            <Panel>
              <p className="text-sm text-foreground/55">
                Aún no hay métodos de pago configurados.
              </p>
            </Panel>
          )}
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {methods.data.payment.map((payment) => (
              <Panel key={payment.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-semibold">
                    {payment.label}
                  </h3>
                  <span className="text-xs text-foreground/55">
                    {payment.enabled ? "Habilitado" : "Deshabilitado"}
                  </span>
                </div>
                <p className="mb-4 text-xs text-foreground/45">
                  {paymentNames[payment.code]}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    Editar método
                  </summary>
                  <div className="mt-5">
                    <PaymentEditor payment={payment} />
                  </div>
                </details>
              </Panel>
            ))}
          </div>
          {availableCodes.length > 0 && (
            <Panel>
              <h2 className="mb-5 font-display text-xl font-semibold">
                Agregar método de pago
              </h2>
              <PaymentEditor availableCodes={availableCodes} />
            </Panel>
          )}
        </>
      )}
      {section === "pagos" && <GatewayConfiguration />}
      {section === "entregas" && methods.data && (
        <>
          <h2 className="font-display text-xl font-semibold">
            Métodos configurados
          </h2>
          <p className="text-xs text-foreground/50">
            Se muestran por nombre. Deshabilitar un método no modifica los
            pedidos existentes.
          </p>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {methods.data.shipping.map((shipping) => (
              <Panel key={shipping.id}>
                <h3 className="font-display text-xl font-semibold">
                  {shipping.label}
                </h3>
                <p className="my-3 text-sm text-foreground/55">
                  {shipping.kind === "PICKUP" ? "Retiro" : "Delivery"} ·{" "}
                  <Money value={shipping.fee} /> ·{" "}
                  {shipping.enabled ? "Habilitado" : "Deshabilitado"}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    Editar entrega
                  </summary>
                  <div className="mt-5">
                    <ShippingEditor shipping={shipping} />
                  </div>
                </details>
              </Panel>
            ))}
          </div>
          <Panel>
            <h2 className="mb-5 font-display text-xl font-semibold">
              Agregar método de entrega
            </h2>
            <ShippingEditor />
          </Panel>
        </>
      )}
    </div>
  );
}
