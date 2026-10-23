import { Card } from "@/components/ui/card";
import { getServerSession } from "@/lib/session";
import {
  Settings,
  Globe,
  Palette,
  Bell,
  Database,
  Key,
  Monitor,
  Moon,
  Sun,
  CreditCard,
  LucideIcon,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { ProfileCompletenessIndicator } from "@/components/settings/profile-completeness";
import { DangerZone } from "@/components/settings/danger-zone";

type SelectOption = { value: string; label: string; icon?: LucideIcon };

type SettingsItem =
  | {
      label: string;
      description: string;
      type: "select";
      options: SelectOption[];
      current: string;
    }
  | { label: string; description: string; type: "toggle"; enabled: boolean }
  | { label: string; description: string; type: "button"; action: string };

type SettingsSection = {
  title: string;
  icon: LucideIcon;
  items: SettingsItem[];
  link?: string;
  isPayment?: boolean;
};

export default async function SettingsPage() {
  const session = await getServerSession();
  const roles: string[] = session?.user?.roles || [];
  const isPaymentAdmin = roles.includes("SUPER_ADMIN");
  const isCompanyAdmin = roles.includes("COMPANY_ADMIN");

  const settingsSections: SettingsSection[] = [
    {
      title: "Empresa",
      icon: Building2,
      items: [
        {
          label: "Datos de la empresa",
          description: "RUC, dirección, razón social y contacto",
          type: "button" as const,
          action: "company",
        },
      ],
      link: "/settings/company",
    },
    {
      title: "Apariencia",
      icon: Palette,
      items: [
        {
          label: "Tema",
          description: "Selecciona el tema de la aplicación",
          type: "select",
          options: [
            { value: "light", label: "Claro", icon: Sun },
            { value: "dark", label: "Oscuro", icon: Moon },
            { value: "system", label: "Sistema", icon: Monitor },
          ],
          current: "system",
        },
      ],
    },
    {
      title: "Regional",
      icon: Globe,
      items: [
        {
          label: "Zona horaria",
          description: "Para correctamente las fechas y horas",
          type: "select",
          options: [
            { value: "America/Lima", label: "Lima (UTC-5)" },
            { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
            { value: "America/Bogota", label: "Bogotá (UTC-5)" },
          ],
          current: "America/Lima",
        },
        {
          label: "Formato de moneda",
          description: "Cómo se muestran los montos",
          type: "select",
          options: [
            { value: "PEN", label: "S/ (Sol Peruano)" },
            { value: "USD", label: "USD (Dólar)" },
            { value: "EUR", label: "€ (Euro)" },
          ],
          current: "PEN",
        },
        {
          label: "Idioma",
          description: "Idioma de la interfaz",
          type: "select",
          options: [
            { value: "es", label: "Español" },
            { value: "en", label: "English" },
          ],
          current: "es",
        },
      ],
    },
    {
      title: "Notificaciones",
      icon: Bell,
      items: [
        {
          label: "Notificaciones push",
          description: "Recibe alertas en tu navegador",
          type: "toggle",
          enabled: true,
        },
        {
          label: "Notificaciones de ventas",
          description: "Alertas cuando se registren nuevas ventas",
          type: "toggle",
          enabled: true,
        },
        {
          label: "Alertas de stock bajo",
          description: "Notificaciones cuando el inventario esté bajo",
          type: "toggle",
          enabled: true,
        },
        {
          label: "Resumen diario",
          description: "Recibe un resumen cada mañana",
          type: "toggle",
          enabled: false,
        },
      ],
    },
    {
      title: "Datos",
      icon: Database,
      items: [
        {
          label: "Exportar datos",
          description: "Descarga todos tus datos en JSON",
          type: "button",
          action: "export",
        },
        {
          label: "Copias de seguridad",
          description: "Configurar backups automáticos",
          type: "button",
          action: "backup",
        },
      ],
    },
    {
      title: "API",
      icon: Key,
      items: [
        {
          label: "API Keys",
          description: "Gestiona las claves de acceso a la API",
          type: "button" as const,
          action: "keys",
        },
        {
          label: "Webhooks",
          description: "Configura endpoints para eventos",
          type: "button" as const,
          action: "webhooks",
        },
      ],
    },
    ...(isPaymentAdmin
      ? [
          {
            title: "Pagos",
            icon: CreditCard,
            items: [
              {
                label: "Métodos de pago",
                description: "Configura Yape, Stripe, MercadoPago y más",
                type: "button" as const,
                action: "payment",
              },
            ],
            link: "/platform/settings/payment",
            isPayment: true,
          },
        ]
      : isCompanyAdmin
        ? [
            {
              title: "Suscripción",
              icon: CreditCard,
              items: [
                {
                  label: "Mi plan",
                  description:
                    "Verifica tu plan actual y mejora tu suscripción",
                  type: "button" as const,
                  action: "subscription",
                },
                {
                  label: "Mis pagos",
                  description: "Historial de pagos y subir comprobantes",
                  type: "button" as const,
                  action: "payments",
                },
              ],
              link: "/subscription",
            },
          ]
        : []),
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-slate-700 to-slate-900 p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-white/10 p-3">
            <Settings className="size-8" />
          </div>
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              Administración
            </p>
            <h1 className="mt-1 break-words font-display text-3xl leading-tight sm:text-4xl">
              Configuración
            </h1>
            <p className="mt-1 text-white/60">Personaliza tu experiencia</p>
          </div>
        </div>
      </Card>

      <ProfileCompletenessIndicator />

      <div className="grid gap-6 xl:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="rounded-[30px] bg-card/80 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-muted p-2">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <h2 className="font-display text-xl">{section.title}</h2>
              </div>

              <div className="mt-6 space-y-4">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-foreground/50">
                        {item.description}
                      </p>
                    </div>

                    {item.type === "toggle" && (
                      <button
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          item.enabled ? "bg-foreground/80" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-card transition-transform ${
                            item.enabled ? "left-6" : "left-1"
                          }`}
                        />
                      </button>
                    )}

                    {item.type === "select" && (
                      <select className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2 text-sm sm:w-auto">
                        {item.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {item.type === "button" && section.isPayment ? (
                      <Link
                        href={section.link || ""}
                        className="w-full rounded-xl border border-foreground/20 px-4 py-2 text-center text-sm font-medium transition hover:bg-foreground/5 sm:w-auto"
                      >
                        Configurar
                      </Link>
                    ) : item.type === "button" && item.action === "payments" ? (
                      <Link
                        href="/payments"
                        className="w-full rounded-xl border border-foreground/20 px-4 py-2 text-center text-sm font-medium transition hover:bg-foreground/5 sm:w-auto"
                      >
                        Ver
                      </Link>
                    ) : item.type === "button" && section.link ? (
                      <Link
                        href={section.link}
                        className="w-full rounded-xl border border-foreground/20 px-4 py-2 text-center text-sm font-medium transition hover:bg-foreground/5 sm:w-auto"
                      >
                        Ver
                      </Link>
                    ) : (
                      item.type === "button" && (
                        <button className="w-full rounded-xl border border-foreground/20 px-4 py-2 text-center text-sm font-medium transition hover:bg-foreground/5 sm:w-auto">
                          {item.action === "export" && "Exportar"}
                          {item.action === "backup" && "Configurar"}
                          {item.action === "keys" && "Gestionar"}
                          {item.action === "webhooks" && "Configurar"}
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <DangerZone canCancelSubscription={isCompanyAdmin} />
    </div>
  );
}
