# Área: Librerías y cliente API

Documenta el cliente HTTP, los helpers de sesión/plan, las validaciones, los hooks de
datos y los tipos del frontend. Ruta del código: `frontend/`.

## Rutas y páginas

Esta área no define páginas; corresponde a librerías, hooks y tipos consumidos por las
demás áreas.

| Elemento | Archivo | Tipo | Descripción |
|----------|---------|------|-------------|
| Cliente HTTP | `frontend/lib/api.ts` | lib cliente | `apiFetch<T>` y re-export de utilidades de auth. |
| Cliente auth | `frontend/lib/api/auth.ts` | lib cliente | `login`, `register`, `logout`, `getMe`, `updateProfile`, `refreshToken` y tipos de auth. |
| Cliente servidor | `frontend/lib/server-api.ts` | lib servidor | `serverApiFetch<T>` con `Authorization: Bearer`. |
| Errores de límite | `frontend/lib/handle-limit-error.ts` | lib cliente | `handleLimitError(err)` normaliza errores de límite/plan. |
| Capacidades (cliente) | `frontend/lib/plan-capabilities.ts` | lib | Tipos y funciones de gating de módulos/features/rutas. |
| Capacidades (servidor) | `frontend/lib/plan-capabilities-server.ts` | lib servidor | `fetchPlanCapabilities(accessToken)`. |
| Utilidades | `frontend/lib/utils.ts` | lib | `cn(...)` (clsx + tailwind-merge). |
| Compresión de imágenes | `frontend/lib/image-compression.ts` | lib cliente | `compressImage(file, options)`. |
| Validaciones Perú | `frontend/lib/validations.ts` | lib | Regex/formato/validación de teléfono, DNI, RUC, email. |
| Validaciones zod | `frontend/lib/validations/*.ts` | lib | Esquemas zod por entidad. |
| SDK compartido | `frontend/lib/shared/sdk.ts` | lib | Esquemas zod de modelos (uso no verificado). |
| Hooks de datos | `frontend/hooks/useData.ts` | lib cliente | `useProducts`, `useCategories`, `useCustomers`, `useEmployees`, `useSales` e invalidadores. |
| Límites de suscripción | `frontend/hooks/use-subscription-limits.ts` | lib cliente | `useSubscriptionLimits`, `getLimitWarning`, `isLimitExceeded`. |
| Tipos | `frontend/types/*` | tipos | Tipos generados y variantes de la API. |

## Componentes

No aplica (no son componentes React). Consumidores relevantes:

- `frontend/components/products/product-form.tsx`, `frontend/components/customers/customer-form.tsx`, `frontend/components/employees/employee-form.tsx`, `frontend/components/categories/category-form.tsx` — usan `handleLimitError` al capturar errores.
- `frontend/components/common/subscription-usage.tsx` — usa `useSubscriptionLimits`.

## Llamadas al backend

| Página/UI | Endpoint (método) | Función del cliente | Notas |
|-----------|-------------------|---------------------|-------|
| `apiFetch` (genérico) | `/{path}` (método según `init`) | `apiFetch<T>(path, init)` | Prefijo `/api`; `credentials: 'include'`. |
| Reintento de sesión | `POST /api/auth/refresh` | `refreshAccessToken()` (interno de `api.ts`) | Deduplicado con `refreshPromise`; solo ante `401` y rutas que no empiezan por `/auth/`. |
| `serverApiFetch` | `/{path}` (GET) | `serverApiFetch<T>(path, accessToken)` | `Authorization: Bearer`; `cache: 'no-store'`; devuelve `null` si falla o no hay token. |
| `fetchPlanCapabilities` | `GET /api/plan-capabilities/me` | `serverApiFetch<PlanCapabilities>('/plan-capabilities/me')` | Usado por `(dashboard)/layout.tsx`. |
| `useProducts` | `GET /api/products` | `withToken<Product[]>('/products')` | `staleTime: 5 min`. |
| `useCategories` | `GET /api/products/categories` | `withToken<Category[]>('/products/categories')` | `staleTime: 5 min`. |
| `useCustomers` | `GET /api/customers` | `withToken<Customer[]>('/customers')` | `staleTime: 5 min`. |
| `useEmployees` | `GET /api/employees` | `withToken<Employee[]>('/employees')` | `staleTime: 5 min`. |
| `useSales` | `GET /api/sales` | `withToken<Sale[]>('/sales')` | `staleTime: 5 min`. |
| `useSubscriptionLimits.fetchLimits` | `GET /api/{module}/limits` | `apiFetch<LimitsInfo>('/{module}/limits')` | `module` ∈ `products`\|`employees`\|`customers`. |

## Firma y comportamiento de `apiFetch`

```ts
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string; skipRefresh?: boolean },
): Promise<T>
```

- `path`: se normaliza con `/` inicial; se concatena a `API_URL = '/api'`.
- `init.token`: si no hay header `Authorization` explícito, agrega `Authorization: Bearer <token>`.
- `init.skipRefresh`: si es `true`, desactiva el reintento por `401`.
- Siempre agrega `Content-Type: application/json` y `credentials: 'include'`.
- **Tokens**: la sesión viaja en cookies httpOnly (`access_token`/`refresh_token`), por eso `credentials: 'include'`. Al recibir `401` (salvo rutas `/auth/*` o `skipRefresh`), ejecuta `refreshAccessToken()` (una sola vez, compartida por un `refreshPromise` de módulo) y reintenta la petición una vez.
- **Errores**: `parseError` lee el cuerpo como texto, intenta `JSON.parse` y devuelve `new Error(message || 'Error <status>', { cause: <json> })`. No registra en consola los errores con código `LIMIT_EXCEEDED`.
- **Respuesta**: `response.json()` tipado como `T`.

## Manejo de errores de límite (`handleLimitError`)

```ts
export function handleLimitError(err: unknown): { message: string; isLimitError: boolean }
```

- Extrae el código de `err.error` o de `err.cause.error` (el `cause` es el JSON que `apiFetch` adjunta al `Error`).
- Marca `isLimitError = true` y reescribe el mensaje cuando el código es `LIMIT_EXCEEDED`, `API_QUOTA_EXCEEDED` o el mensaje contiene `límite` (convierte `Has alcanzado el límite de ...` en un texto con recomendación de mejorar plan).
- Marca `isLimitError = true` y agrega `Mejora tu plan para desbloquearlo.` cuando el código es uno de `PLAN_UPGRADE_CODES`: `MODULE_NOT_ENABLED`, `FEATURE_NOT_AVAILABLE`, `PLAN_REQUIRED`.
- En cualquier otro caso devuelve el mensaje original con `isLimitError = false`.

## Gating de plan

- `plan-capabilities.ts` define `PlanCapabilities` (`modules`, `features`, `apiEnabled`, `apiQuota`, `maxUsers`, `maxProducts`, `apiUsage`, ...), `PLAN_MODULE_KEYS`, `PLAN_FEATURE_KEYS`, `CORE_MODULES = ['dashboard','notifications']` y etiquetas (`MODULE_LABELS`, `FEATURE_LABELS`).
- `getRouteRequirement(pathname)` mapea rutas a requisitos: `/inventory/kardex` → `{ module: 'inventory', feature: 'inventory.kardex' }`; `/inventory/batches` → `{ module: 'inventory', feature: 'inventory.batches' }`; `/distributors` → `{ module: 'distributors' }`; `/employees` → `{ module: 'employees' }`.
- `hasModule`/`hasFeature` devuelven `true` si `capabilities` es nulo (permisivo) y los módulos core siempre pasan. `satisfiesRequirement` combina ambos; `missingRequirementLabel` devuelve la etiqueta de la feature/módulo faltante.
- `plan-capabilities-server.ts` obtiene las capacidades reales desde el backend (`/plan-capabilities/me`), que el layout entrega al `PlanCapabilitiesProvider`.

## Estado global

- No hay stores Zustand en esta área. El estado vive en React Query (caché por `queryKey`, `staleTime` 60s por defecto) y en los stores de `frontend/stores/auth.store.ts` y `frontend/store/*`.

## Flujo de usuario

1. Una pantalla llama a `apiFetch('/recurso')`; si la cookie de acceso expiró, se refresca de forma transparente y la petición se reintenta.
2. Los formularios de entidades envuelven sus `submit` en `try/catch` y pasan el error por `handleLimitError` para distinguir límites de plan y mostrar el mensaje adecuado.
3. El layout de dashboard obtiene `PlanCapabilities` con `fetchPlanCapabilities` y el sidebar/route guard usan `can`/`satisfiesRequirement` para bloquear módulos no incluidos.

## Notas

- `lib/validations/index.ts` reexporta `product`, `customer`, `employee`, `category`, `sale` y `discount`; los esquemas se pueden importar desde el barrel o por ruta directa.
- `lib/shared/sdk.ts` define esquemas zod y el objeto `ApiSchemas`, pero no se encontraron imports que lo usen (uso no verificado en el código).
- `lib/api/auth.ts` `getAccessToken`, `getRefreshToken` e `isAuthenticated` son stubs que devuelven `undefined`/`undefined`/`false`; `useData.ts` llama a `getAccessToken()` y pasa el resultado (siempre `undefined`) como `token`, por lo que la autenticación efectiva depende de las cookies.
- `lib/validations.ts` (archivo único) es distinto de `lib/validations/` (directorio). El archivo contiene validaciones/formateos de Perú; el directorio contiene esquemas zod por entidad.
- `useSubscriptionLimits` mantiene su propio estado local con `useState` (no usa React Query) y expone `fetchLimits(module)` para disparar la carga manualmente.
- `types/generated.ts` está marcado como autogenerado desde el esquema Prisma ("DO NOT EDIT"); incluye enums (`CompanyStatus`, `SaleStatus`, etc.), modelos (`User`, `Company`, `Product`, `Sale`, ...), DTOs (`CreateProductDto`, `LoginDto`, ...) y tipos de organización (`Branch`, `ProductBatch`, `InventoryKardex`, `PaymentSetting`, `CheckoutRequest`, `PaymentProof`, `InvoiceTemplate`).
- `server-api.ts` requiere `accessToken`; si no se pasa, retorna `null` sin llamar al backend.
- La URL base del backend en cliente es siempre `/api` (proxy por rewrite); en servidor se resuelve con `BACKEND_URL` o `NEXT_PUBLIC_API_URL` (fallback `http://localhost:4000/api`).
