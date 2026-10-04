# Revisión del Sistema Completo - Backend + Frontend

**Fecha:** 03 de Octubre de 2026  
**Proyecto:** Sistema de Ventas SaaS Multi-Empresa  
**Estado actual:** Base sólida, requiere mejoras de seguridad, integridad multi-tenant y robustez

---

## 1. Resumen Ejecutivo

El sistema cuenta con una arquitectura bien estructurada: NestJS + Prisma + PostgreSQL para backend, Next.js 16 (App Router) + React 19 + Tailwind para frontend. Implementa multi-tenancy por `companyId`, autenticación con JWT + cookies httpOnly, validación global, rate limiting, guards de tenant y límites por suscripción.

Sin embargo, existen puntos críticos a corregir principalmente en: **integridad de datos multi-tenant (unicidades globales)**, **seguridad de tokens (localStorage vs httpOnly)**, **validación de tenant en guards** y **completitud del flujo de autenticación**.

---

## 2. Análisis del Backend

### 2.1 Arquitectura y Configuración

| Aspecto | Estado | Observación |
|---|---|---|
| **NestJS + TypeScript** | Excelente | Estructura modular, DTOs con class-validator, DI correcta. |
| **Prisma 7 + adapter-pg** | Bueno | Usa `onModuleInit/onModuleDestroy` (correcto). `relationMode: prisma` apropiado para Supabase/Neon. |
| **Config con Zod** | Excelente | Validación de variables de entorno al inicio. |
| **Trust proxy + Helmet** | Bueno | Configurado para Render/Nginx. Falta CSP. |
| **CORS** | Aceptable | Regex `\.vercel\.app$` amplio para previews. Mejor mover a env. |
| **Rate Limiting (Throttler)** | Básico | Global 60 req/min. Necesita límites específicos para auth. |
| **Exception Filter** | Bueno | Centralizado, diferencia HttpException vs Error. |

### 2.2 Autenticación y Autorización

| Componente | Estado | Observación |
|---|---|---|
| **AuthController** | Bueno | Login/register/refresh/me/logout con cookies httpOnly. |
| **AuthService** | Bueno | Verifica credenciales con `argon2`, valida estado de compañía en login, genera tokens con claims completos. |
| **JwtStrategy** | Bueno | Extrae token de cookie o Bearer, hace cache de `companyStatus` (30s). |
| **JwtAuthGuard** | Correcto | Soporta `@Public()`, maneja casos correctamente. |
| **TenantGuard** | Bueno | Exime SUPER_ADMIN/SUPPORT_ADMIN, bloquea SUSPENDED/INACTIVE/PAST_DUE. |
| **RolesGuard** | Correcto | SUPER_ADMIN bypass, fallback a roles. |
| **PermissionsGuard** | Presente | Base para granularidad. |
| **SubscriptionLimitGuard** | **CRÍTICO** | Confía en `request.headers['x-company-id']` como override. **Puede ser spoofeado**. Debe usar solo `request.user.companyId`. |

### 2.3 Modelo de Datos (Prisma Schema)

#### Problemas de Multi-Tenancy (CRÍTICOS)

| Modelo | Campo Único | Tipo | Riesgo | Recomendación |
|---|---|---|---|---|
| **Product** | `sku @unique` | Global | Colisión entre empresas | `@@unique([companyId, sku])` |
| **Product** | `barcode @unique` | Global | Colisión entre empresas | `@@unique([companyId, barcode])` |
| **Employee** | `dni @unique` | Global | Impide mismo DNI en otra empresa | `@@unique([companyId, dni])` |
| **Sale** | `saleNumber @unique` | Global | Conflictos entre tenants | `@@unique([companyId, saleNumber])` (o secuencial por empresa) |
| **Customer** | Sin unicidad | - | Duplicados | Evaluar `@@unique([companyId, email])` (con `email?`), `@@unique([companyId, documentValue])` si aplica |

#### Correctos

| Modelo | Unicidad | Comentario |
|---|---|---|
| **Category** | `@@unique([companyId, slug])` | Correcto, aislado por tenant. |
| **Membership** | `@@unique([userId, companyId])` | Correcto. |
| **Subscription** | `@@unique([companyId])` | Correcto (1-1). |

#### Otras Observaciones

| Aspecto | Observación | Recomendación |
|---|---|---|
| **SaleItem -> Product (onDelete)** | `onDelete: Cascade` | Si se elimina producto con historial de ventas, se pierde trazabilidad. Considerar `Restrict` + soft delete. |
| **Kardex/InventoryMovement** | Excelente | Trazabilidad completa. Asegurar escrituras atómicas (transacciones). |
| **AuditLog** | Bien modelado | Presente pero poco usado. Debe integrarse en mutaciones críticas. |
| **Soft Delete** | Ausente | Añadir `deletedAt DateTime?` en entidades críticas (Product, Customer, Category, Employee). |
| **SSL Prisma** | Hardcodeado `rejectUnauthorized: false` | Configurable por env (`DB_SSL=true/false`, `DB_SSL_REJECT_UNAUTHORIZED=true/false`). |

### 2.4 Módulos y Negocio

| Módulo | Estado | Comentario |
|---|---|---|
| **Auth** | Funcional | Faltan: `change-password`, `reset-password` completo, rotación de refresh tokens. |
| **SubscriptionLimitService** | Bueno | `sales: 0` como placeholder. Definir si limitar ventas por plan. |
| **Tenant/Audit/Inventory/Kardex** | Avanzados | Muy buen nivel para SaaS profesional. |

---

## 3. Análisis del Frontend

### 3.1 Arquitectura

| Aspecto | Estado | Observación |
|---|---|---|
| **Next.js 16 (App Router)** | Excelente | Uso correcto de RSC, server/client boundaries. |
| **Zustand** | Bueno | Auth store limpio y funcional. |
| **React Hook Form + Zod** | Excelente | Validación cliente-side correcta. |
| **TypeScript** | Bueno | Tipado estricto, tipos generados. |
| **Tailwind + shadcn/ui** | Bueno | UI moderna y consistente. |

### 3.2 Autenticación Frontend (Punto Crítico)

| Aspecto | Estado | Riesgo | Recomendación |
|---|---|---|---|
| **localStorage para tokens** | **Problemático** | Vulnerable a XSS (tokens accesibles JS). | Migrar a **cookie-only** (httpOnly). Backend ya envía cookies. |
| **Duplicidad token (localStorage + cookie)** | **Confuso** | Inconsistente entre cliente/servidor. | Eliminar localStorage. Confiar en cookies + `credentials: 'include'`. |
| **`auth.ts` - getMe usa Bearer + credentials** | Inconsistente | Mezcla dos estrategias. | Quitar `Authorization: Bearer`, usar solo cookie. |
| **setTokens escribe localStorage + cookies JS** | Redundante | Escribe cookies desde cliente (no httpOnly). Mejor no hacerlo. | Backend setea httpOnly cookies. Cliente no debe manipular tokens. |
| **Interceptor/refresh** | Parcial | Depende de localStorage. | Simplificar con cookie-only (401 → refresh vía cookie). |
| **Proxy.ts vs next.config rewrites** | Solapado | Dos mecanismos para `/api`. Clarificar. | `next.config.ts` hace rewrites a backend (prod). Route Handlers en `app/api/*` como BFF opcional. |

### 3.3 Rutas y UX

| Ruta/Página | Estado | Comentario |
|---|---|---|
| **/sign-in, /sign-up** | Excelente | Diseño profesional, UX buena, manejo de errores correcto. |
| **Estados de cuenta** | Bueno | `/plan-expired`, `/account-suspended`, `/forbidden` presentes. |
| **Middleware/guards UI** | A revisar | Falta middleware raíz claro (hay `utils/supabase/middleware.ts` pero parece no usado). |
| **Supabase utils** | Híbrido | Código Supabase presente pero auth principal es JWT propio. Limpiar si no usado. |

---

## 4. Seguridad - Hallazgos Detallados

| Vulnerabilidad/Punto | Severidad | Estado Actual | Mitigación |
|---|---|---|---|
| **Tokens en localStorage (XSS)** | Alta | Presente | Eliminar. Usar httpOnly cookies únicamente. |
| **Header `x-company-id` spoofeable** | **Crítica** | Presente (guard) | Quitar override por header. Solo `request.user.companyId`. |
| **Refresh token sin rotación** | Alta | Presente | Implementar rotación + detección de reuse (tabla RefreshToken). |
| **Refresh token sin revocación en logout** | Alta | Parcial | Marcar como revocado en BD al logout. |
| **Rate limit genérico auth** | Media-Alta | Global | Específico: login/register/refresh (ej. 5-10 req/5min). |
| **CSP ausente** | Media | No configurado | Añadir `helmet.contentSecurityPolicy`. |
| **SameSite cookies** | Media | `lax` | Evaluar `none`+`secure` (cross-site frontend-backend). |
| **SSL Prisma permisivo** | Baja-Media | `rejectUnauthorized: false` | Configurable por env. |
| **Forgot/Reset password incompleto** | Media | Stub | Implementar flujo completo con tokens temporales. |

---

## 5. Recomendaciones Prioritarias (Roadmap)

### Prioridad 1 - CRÍTICO (Seguridad + Integridad de Datos)

1. **Corregir SubscriptionLimitGuard** - Eliminar lectura de `x-company-id` header. Usar únicamente `request.user.companyId`.
2. **Ajustar unicidades multi-tenant en Prisma** - Product(sku,barcode), Employee(dni), Sale(saleNumber), Customer (evaluar email/document).
3. **Migrar frontend a cookie-only** - Eliminar localStorage, Bearer tokens. Usar `credentials: 'include'` únicamente.
4. **Generar migración Prisma** - Revisar datos existentes antes de aplicar cambios de unicidad.

### Prioridad 2 - ALTO (Robustez Auth)

5. **Refresh Token Rotation + Reuse Detection** - Crear modelo `RefreshToken`, hash, revocación, rotación, detección de reuse (revocar familia).
6. **Completar Auth** - `POST /auth/change-password` (oldPassword + newPassword), `POST /auth/forgot-password`, `POST /auth/reset-password` (token + expiry).
7. **Logout robusto** - Revocar refresh token en BD + limpiar cookies.
8. **Rate limiting específico auth** - Throttler por endpoint (login/register/refresh/forgot).

### Prioridad 3 - MEDIO-ALTO (Hardening + Auditoría)

9. **Hardening** - CSP en Helmet, CORS desde env (`CORS_ORIGINS`), SSL Prisma configurable, headers de seguridad.
10. **AuditLog activo** - Integrar en servicios críticos (Sales, Products, Customers, Employees, Users, Subscriptions, InventoryMovements).
11. **Soft Delete** - Añadir `deletedAt` a entidades con historial (Product, Customer, Employee, Category).
12. **SaleItem onDelete** - Evaluar `Restrict` para preservar integridad histórica.

### Prioridad 4 - MEJORAS (UX + Mantenibilidad)

13. **Limpiar código** - Eliminar `utils/supabase/*` si no usado, clarificar proxy vs rewrites.
14. **Mejorar validaciones** - DTOs más estrictos, normalización (trim, slug seguro).
15. **Documentación** - Mantener este informe + plan detallado por archivo en `docs/`.

---

## 6. Conclusión

El sistema está **muy bien encaminado** y con un nivel profesional notable. Las correcciones propuestas son principalmente de **endurecimiento (seguridad)** e **integridad multi-tenant**. Aplicando las prioridades 1 y 2 se eleva considerablemente la solidez para producción.

**Veredicto:** Listo para mejoras con enfoque incremental, empezando por los ítems CRÍTICOS.