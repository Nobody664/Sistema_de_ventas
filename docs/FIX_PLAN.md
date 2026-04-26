# Plan de Fixes - Backend Prisma Alignment

## Resumen Ejecutivo

El schema de Prisma está bien definido. El problema es que el código usa nombres de campos incorrectos de versiones anteriores. Necesitamos alinear TODO el código al schema existente.

---

## Cambios Críticos Requeridos

### 1. Fields Renamed (código usa nombres viejos)
| CampoViejo | CampoNuevo | Archivo |
|------------|------------|---------|
| `salePrice` | `price` | products.service.ts, dashboard.service.ts |
| `minStock` | `minStockLevel` | products.service.ts |
| `subscription` (singular) | `subscriptions` (plural) | companies.service.ts |

### 2. Model Names Incorrectos
| Uso Incorrecto | Uso Correcto | Archivo |
|---------------|--------------|---------|
| `companyMembership` | `membership` | auth.service.ts |

### 3. Models/Relations Faltantes en Schema
- `PaymentProof` - referenced but not in schema → need to add or remove code
- `PlanUpgradeRequest` needs `currentPlanId`/`newPlanId` - currently only has `planId`

---

## Archivos a Modificar (en orden de prioridad)

1. **products.service.ts** - salePrice → price, minStock → minStockLevel
2. **dashboard.service.ts** - salePrice → price
3. **auth.service.ts** - companyMembership → membership
4. **companies.service.ts** - subscription → subscriptions
5. **payments/payment-settings.service.ts** - remove PaymentProof references
6. **plans/plan-upgrade-requests.service.ts** - fix plan relations
7. **users.service.ts** - revisar usage de Membership
8. **customers.service.ts** - revisar relations
9. **employees.service.ts** - revisar relations
10. **reports.service.ts** - revisar queries

---

## Ejecución

```bash
# 1. Regenerar Prisma Client
cd backend && DATABASE_URL=... npx prisma generate

# 2. Build y verificar
npm run build
```

---

## Estado: En Progreso

Última actualización: 2026-04-25