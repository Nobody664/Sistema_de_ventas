# Plan de Implementación: Perfil de Empresa Completo

## 1. Objetivo

Sistema automático que detecte campos incompletos del perfil de empresa y envíe notificaciones contextuales persuadiendo al COMPANY_ADMIN a completarlos.

**Ejemplo con mensajes reales:**

| Campo faltante | Notificación |
|----------------|-------------|
| RUC | "Aún falta conocerte un poco más. Completa tu RUC para que tus clientes tengan más confianza al adquirir tus productos." |
| Razón Social | "Completa tu Razón Social para que tus facturas y boletas tengan validez legal." |
| Dirección | "Completa tu dirección así tus clientes podrán encontrarte más rápido." |
| Teléfono | "Agrega un teléfono de contacto para que tus clientes puedan comunicarse contigo." |
| Logo | "Sube el logo de tu empresa para personalizar tus comprobantes y dar una imagen profesional." |

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Cron Diario (CompanyProfileCron)                   │
│  @Cron(EVERY_DAY_AT_8AM)                            │
│                                                     │
│  1. Obtener empresas ACTIVAS                        │
│  2. Por cada empresa, evaluar perfil:               │
│     ┌─────────────────┐                             │
│     │ taxId → RUC     │                             │
│     │ legalName → RS  │  Score de completitud       │
│     │ address → Dir   │                             │
│     │ phone → Tel     │                             │
│     └─────────────────┘                             │
│  3. Si score < 100% → notificar                     │
│  4. No notificar si ya se notificó hace <30 días    │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  CompanyProfileService                               │
│                                                     │
│  - getProfileCompleteness(companyId): ProfileScore   │
│  - getMissingFields(companyId): string[]             │
│  - shouldNotify(companyId): boolean (rate limit)     │
│  - sendCompletionSuggestions(companyId): void        │
└─────────────────────────────────────────────────────┘
```

### Decisiones de Arquitectura

**¿Por qué un servicio separado y no dentro de BillingService?**
- Single Responsibility: BillingService ya maneja 5 responsabilidades (payments, past-due, suspension, trials, reminders)
- CompanyProfileService tiene un dominio claramente distinto (perfil de empresa, no facturación)
- Fácil de extender: nuevo campos, scorer personalizado, dashboard de completitud

**¿Por qué notificar máximo 1 vez cada 30 días?**
- Evitar spam al usuario
- Si el usuario ignora la notificación, no tiene sentido repetirla a diario
- Si completa algún campo pero no todos, el score cambia → se puede notificar de nuevo (con nuevo mensaje)

---

## 3. Modelo de Datos

### Nuevo modelo: `company_profile_notifications` (tracking de notificaciones enviadas)

```prisma
model CompanyProfileNotification {
  id        String   @id @default(cuid())
  companyId String   @map("company_id")
  field     String   // "taxId" | "legalName" | "address" | "phone" | "logo"
  createdAt DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])

  @@map("company_profile_notifications")
  @@index([companyId, field])
}
```

Alternativa más simple: **No crear modelo nuevo**. Usar el sistema de notificaciones existente + un campo en la tabla de notificaciones para tracking de última notificación por tipo. O más simple aún: guardar en el campo `data` (JSON) de la notificación el campo específico que se notificó y usar `createdAt` para rate-limit.

### Score de completitud

```typescript
interface ProfileField {
  key: string;
  label: string;
  weight: number;       // 0-100, qué tanto impacta en el score
  message: string;      // Mensaje persuasivo
  validate: (value: string | null) => boolean;
}

const PROFILE_FIELDS: ProfileField[] = [
  { key: 'taxId',     label: 'RUC',           weight: 30, message: 'mensaje_taxId',  validate: (v) => !!v && /^\d{11}$/.test(v) },
  { key: 'legalName', label: 'Razón Social',  weight: 25, message: 'mensaje_legal',  validate: (v) => !!v && v.length >= 3 },
  { key: 'address',   label: 'Dirección',     weight: 20, message: 'mensaje_address', validate: (v) => !!v && v.length >= 10 },
  { key: 'phone',     label: 'Teléfono',      weight: 15, message: 'mensaje_phone',  validate: (v) => !!v },
  { key: 'email',     label: 'Email',         weight: 10, message: 'mensaje_email',  validate: (v) => !!v && /@/.test(v) },
];
```

---

## 4. Servicio Principal

### CompanyProfileService

**Archivo nuevo**: `backend/src/modules/company-profile/company-profile.service.ts`

```typescript
@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Calcula el score de completitud (0-100)
  async getProfileCompleteness(companyId: string): Promise<{
    score: number;
    totalFields: number;
    completedFields: number;
    missingFields: string[];
  }> { /* ... */ }

  // Obtener campos faltantes
  async getMissingFields(companyId: string): Promise<ProfileField[]> { /* ... */ }

  // Verifica si debe notificar (rate-limit 30 días)
  async shouldNotify(companyId: string, field: string): Promise<boolean> { /* ... */ }

  // Enviar notificaciones para campos faltantes
  async sendCompletionSuggestions(companyId: string, userId: string): Promise<number> {
    const missing = await this.getMissingFields(companyId);
    let sent = 0;

    for (const field of missing) {
      const canNotify = await this.shouldNotify(companyId, field.key);
      if (!canNotify) continue;

      const { title, message } = this.getMessageForField(field);

      await this.notificationsService.create({
        userId,
        companyId,
        type: 'GENERAL',
        channel: 'IN_APP',
        title,
        message,
        data: { field: field.key, action: `/settings/company` },
      });

      // Registrar notificación enviada
      await this.prisma.companyProfileNotification.create({
        data: { companyId, field: field.key },
      });

      sent++;
    }

    return sent;
  }

  // Mensajes contextuales por campo
  private getMessageForField(field: ProfileField): { title: string; message: string } {
    const messages: Record<string, { title: string; message: string }> = {
      taxId: {
        title: 'Completa tu RUC',
        message: 'Aún falta conocerte un poco más. Completa tu RUC para que tus clientes tengan más confianza al adquirir tus productos.',
      },
      legalName: {
        title: 'Completa tu Razón Social',
        message: 'Completa tu Razón Social para que tus facturas y boletas tengan validez legal.',
      },
      address: {
        title: 'Completa tu dirección',
        message: 'Completa tu dirección así tus clientes podrán encontrarte más rápido.',
      },
      phone: {
        title: 'Agrega un teléfono',
        message: 'Agrega un número de contacto para que tus clientes puedan comunicarse contigo.',
      },
      email: {
        title: 'Verifica tu email',
        message: 'Confirma tu correo electrónico para recibir notificaciones importantes de tu negocio.',
      },
    };

    return messages[field.key] ?? {
      title: 'Completa tu perfil',
      message: 'Completa la información de tu empresa para ofrecer una mejor experiencia a tus clientes.',
    };
  }
}
```

### CompanyProfileCron

**Dentro del mismo archivo o separado** — cron que se ejecuta diariamente:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_8AM)
async checkCompanyProfiles() {
  this.logger.log('Checking company profiles...');

  const companies = await this.prisma.company.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    include: {
      memberships: {
        where: { role: 'COMPANY_ADMIN' },
        include: { user: true },
        take: 1,
      },
    },
  });

  let totalSent = 0;
  for (const company of companies) {
    const admin = company.memberships[0]?.user;
    if (!admin) continue;

    const completeness = await this.getProfileCompleteness(company.id);
    if (completeness.score >= 100) continue;

    const sent = await this.sendCompletionSuggestions(company.id, admin.id);
    totalSent += sent;
  }

  this.logger.log(`Profile suggestions sent: ${totalSent}`);
  return totalSent;
}
```

### CompanyProfileController

Endpoint para consultar completitud desde el frontend:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly profileService: CompanyProfileService) {}

  @Get('completeness')
  async getCompleteness(@Req() request: { tenantId: string }) {
    return this.profileService.getProfileCompleteness(request.tenantId);
  }
}
```

---

## 5. Módulo NestJS

**Archivo nuevo**: `backend/src/modules/company-profile/company-profile.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfileController } from './company-profile.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, NotificationsModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
```

> **Nota**: `ScheduleModule.forRoot()` ya está importado en `BillingModule`. Agregar `ScheduleModule.forRoot()` de nuevo en un segundo módulo causará un warning. Alternativas:
> 1. Mover `ScheduleModule.forRoot()` a `AppModule` como import global — RECOMENDADO
> 2. Mantener el cron dentro de `BillingModule` y mover solo la lógica a un servicio externo

**Recomendación**: Opción 1. Mover `ScheduleModule.forRoot()` a AppModule para que cualquier módulo pueda tener crons sin duplicados.

### AppModule — cambios

```typescript
// En imports de AppModule:
ScheduleModule.forRoot(),  // Mover desde BillingModule
```

---

## 6. Frontend — Indicador de Completitud

### ProfileCompletenessIndicator

**Componente nuevo**: `frontend/components/settings/profile-completeness.tsx`

```tsx
'use client';

import { CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function ProfileCompletenessIndicator() {
  const { data } = useQuery({
    queryKey: ['profile-completeness'],
    queryFn: () => apiFetch('/company-profile/completeness'),
  });

  if (!data || data.score >= 100) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-amber-800">
            Perfil {data.score}% completo
          </p>
          <ul className="mt-2 space-y-1">
            {data.missingFields.map((field: string) => (
              <li key={field} className="flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="size-3.5" />
                {field}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/settings/company"
          className="flex items-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
        >
          Completar
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
```

### Ubicación

- Agregar en la página de **settings** (`/settings/page.tsx`) arriba de las secciones
- Agregar en el **dashboard** del company admin
- Opcional: en el **header** como badge si el score es bajo

---

## 7. Orden de Implementación

| # | Fase | Archivos | Descripción |
|---|------|----------|-------------|
| 1 | Prisma | `schema.prisma` | Agregar modelo `CompanyProfileNotification` |
| 2 | Backend | `company-profile.service.ts` | Servicio con score, missing fields, mensajes |
| 3 | Backend | `company-profile.controller.ts` | Endpoint GET /company-profile/completeness |
| 4 | Backend | `company-profile.module.ts` | Módulo NestJS |
| 5 | Backend | `app.module.ts` | Import CompanyProfileModule, mover ScheduleModule |
| 6 | Frontend | `profile-completeness.tsx` | Componente indicador |
| 7 | Frontend | `settings/page.tsx` | Integrar indicador |
| 8 | Frontend | `lib/api.ts` (types) | Tipos para ProfileCompleteness |

---

## 8. Campos Extensibles

El sistema está diseñado para agregar campos fácilmente:

```typescript
// Solo agregar a PROFILE_FIELDS
{ key: 'logo',       label: 'Logo',        weight: 5,  validate: (v) => !!v },
{ key: 'website',    label: 'Sitio web',    weight: 5,  validate: (v) => !!v && v.startsWith('http') },
{ key: 'description',label: 'Descripción',  weight: 5,  validate: (v) => !!v && v.length >= 20 },
```

Y agregar el mensaje correspondiente en `getMessageForField()`.

---

## 9. Consideraciones

- **Rate limit**: No notificar más de 1 vez cada 30 días por campo
- **Prioridad**: Primero RUC y Razón Social (weight 30+25 = 55% del score)
- **Silenciar**: Si el usuario completa todos los campos, no se notifica más
- **Progresión**: Si completa 1 campo pero faltan otros, se notifica por los restantes (con rate-limit independiente)
- **No molestar**: Empresas INACTIVE/SUSPENDED no se evalúan
- **Dashboard SUPER_ADMIN**: Podría ver un reporte de qué empresas tienen perfil incompleto
