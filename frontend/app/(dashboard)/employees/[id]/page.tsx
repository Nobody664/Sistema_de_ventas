import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Edit,
  Mail,
  Phone,
  Shield,
  User,
  UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { Employee } from "@/types/api";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> =
  {
    COMPANY_ADMIN: {
      label: "Admin",
      color: "text-violet-700",
      bg: "bg-violet-50",
    },
    MANAGER: { label: "Gerente", color: "text-blue-700", bg: "bg-blue-50" },
    CASHIER: {
      label: "Cajero",
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    VIEWER: { label: "Visor", color: "text-amber-700", bg: "bg-amber-50" },
  };

export default async function EmployeeDetailPage({ params }: DetailPageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const employee = await serverApiFetch<Employee>(
    `/employees/${id}`,
    session.accessToken,
  );

  if (!employee) {
    notFound();
  }

  const role = roleConfig[employee.role] ?? roleConfig.VIEWER;
  const fullName = `${employee.firstName} ${employee.lastName ?? ""}`.trim();

  const details = [
    { label: "Nombre completo", value: fullName },
    { label: "Correo electrónico", value: employee.email || "—" },
    { label: "Teléfono", value: employee.phone || "—" },
    { label: "DNI", value: employee.dni || "—" },
    { label: "Rol", value: role.label },
    { label: "Estado", value: employee.isActive ? "Activo" : "Inactivo" },
    {
      label: "Creado",
      value: new Date(employee.createdAt).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
    {
      label: "Actualizado",
      value: new Date(employee.updatedAt).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    },
  ];

  const stats = [
    {
      label: "Rol asignado",
      value: role.label,
      icon: Shield,
      tone: "text-violet-600 bg-violet-500/15",
    },
    {
      label: "Estado",
      value: employee.isActive ? "Activo" : "Inactivo",
      icon: UserCheck,
      tone: employee.isActive
        ? "text-emerald-600 bg-emerald-500/15"
        : "text-red-600 bg-red-500/15",
    },
    {
      label: "Antigüedad",
      value: `${Math.max(1, Math.floor((Date.now() - new Date(employee.createdAt).getTime()) / 86400000))} días`,
      icon: Calendar,
      tone: "text-blue-600 bg-blue-500/15",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a empleados
      </Link>

      <Card className="rounded-[34px] bg-gradient-to-br from-purple-500 to-violet-600 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">
              RRHH
            </p>
            <h1 className="mt-3 break-words font-display text-3xl leading-tight sm:text-4xl">
              {fullName}
            </h1>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
              {employee.email && (
                <span className="flex items-center gap-2">
                  <Mail className="size-4" />
                  {employee.email}
                </span>
              )}
              {employee.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="size-4" />
                  {employee.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 px-6 py-4 text-right">
              <p className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
                <Shield className="size-4" />
                Rol
              </p>
              <p className="mt-1 font-display text-3xl">{role.label}</p>
            </div>
            <Link
              href={`/employees/${employee.id}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-purple-700 shadow-sm hover:bg-purple-50"
            >
              <Edit className="size-4" />
              Editar
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-[30px] bg-white/80 p-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-2xl p-2 ${stat.tone}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">
                    {stat.label}
                  </p>
                  <p className="font-display text-3xl">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-purple-500/15 p-2 text-purple-600">
            <User className="size-5" />
          </div>
          <h2 className="font-display text-2xl">Información del empleado</h2>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs uppercase tracking-[0.18em] text-foreground/40">
                {detail.label}
              </dt>
              <dd className="mt-1 break-words text-sm text-foreground/80">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
