import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Building2, CreditCard, User } from "lucide-react";
import { getServerSession } from "@/lib/session";
import { isPlatformUser } from "@/lib/role-navigation";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { RegionalSettings } from "@/components/settings/regional-settings";
import { ProfileCompletenessIndicator } from "@/components/settings/profile-completeness";
import { DangerZone } from "@/components/settings/danger-zone";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { DataExportSettings } from "@/components/settings/data-export-settings";
import { ApiKeySettings } from "@/components/settings/api-key-settings";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { NotificationChannelsSettings } from "@/components/settings/notification-channels-settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { serverTranslator } from "@/lib/locale-server";

export default async function SettingsPage() {
  const t = await serverTranslator();
  const session = await getServerSession();
  if (!session?.user) redirect("/sign-in");
  const platform = isPlatformUser(session.user.roles);
  const owner =
    !platform &&
    !!session.user.companyId &&
    session.user.roles.includes("COMPANY_ADMIN");
  const links = platform
    ? [
        {
          href: "/profile",
          title: "Mi perfil",
          description: "Tu cuenta de administrador de plataforma.",
          icon: User,
        },
        {
          href: "/platform",
          title: "Administrar plataforma",
          description: "Empresas, planes y herramientas globales.",
          icon: Building2,
        },
        ...(session.user.roles.includes("SUPER_ADMIN")
          ? [
              {
                href: "/platform/settings/payment",
                title: "Métodos de pago globales",
                description:
                  "Configuración de los medios de cobro de la plataforma.",
                icon: CreditCard,
              },
            ]
          : []),
      ]
    : [
        {
          href: "/profile",
          title: "Mi perfil",
          description: "Datos personales y seguridad de tu cuenta.",
          icon: User,
        },
        ...(owner
          ? [
              {
                href: "/settings/company",
                title: "Datos de la empresa",
                description: "Nombre, RUC, dirección y contacto del negocio.",
                icon: Building2,
              },
              {
                href: "/subscription",
                title: "Mi plan",
                description: "Consulta la suscripción y sus características.",
                icon: CreditCard,
              },
              {
                href: "/payments",
                title: "Mis pagos",
                description: "Revisa pagos y envía comprobantes.",
                icon: CreditCard,
              },
            ]
          : []),
      ];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
          {t(platform ? "Plataforma" : "Tu espacio de trabajo")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {t("Configuración")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            owner
              ? "Personaliza tu experiencia y administra los datos de tu negocio."
              : "Personaliza la apariencia y accede a las opciones de tu cuenta.",
          )}
        </p>
      </header>
      {owner && <ProfileCompletenessIndicator />}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ThemeSettings />
        {owner && <RegionalSettings />}
      </div>
      <LanguageSettings owner={owner} />
      <section
        aria-label={t("Opciones de cuenta")}
        className="grid gap-4 sm:grid-cols-2"
      >
        {links.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-orange-500/50"
          >
            <Icon className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{t(title)}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t(description)}
              </p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-orange-500" />
          </Link>
        ))}
      </section>
      {owner && <NotificationSettings />}
      {owner && <NotificationChannelsSettings />}
      {owner && <DataExportSettings />}
      {owner && <ApiKeySettings />}
      {owner && <WebhookSettings />}
      {owner && <DangerZone canCancelSubscription />}
    </div>
  );
}
