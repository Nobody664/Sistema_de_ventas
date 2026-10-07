# Guía de pruebas — correcciones de seguridad y errores HTTP

**Fecha:** 2026-10-06
**Objetivo:** verificar manualmente cada corrección aplicada. Ver también `docs/informes/informe-correcciones-2026-10-06.md`.

---

## 0. Arranque

```powershell
# Terminal 1 — backend
cd E:\Sistema_de_ventas-main\backend
npm run build
npm run dev          # o: node dist\main.js

# Terminal 2 — comprobar que no queda ningún proceso viejo
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*main.js*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

> ⚠️ **Regla de oro:** si un resultado contradice el código, casi siempre hay un proceso con `dist` viejo en el puerto 4000. Matar, reconstruir y reintentar.

```powershell
# Verificación mínima
curl.exe -s -o - -w "`n%{http_code}" http://localhost:4000/api/health/live   # esperado: 200
```

### Datos

- Empresas: `acme` y `nova`. Usuarios demo (contraseña `Admin123!!`):
  `superadmin@ventas-saas.local`, `support@ventas-saas.local`,
  `admin@acme.local`, `manager@acme.local`, `cajero@acme.local`.
- **No existe usuario de NOVA** en el seed demo, así que el paso 1 crea fixtures.

---

## 1. Fixtures (crear datos de NOVA)

Guarda esto como `E:\Sistema_de_ventas-main\backend\prisma\_tmp-fixtures.ts` y bórralo al terminar.

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const p = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
    ssl: { rejectUnauthorized: false },
  }),
});

async function main() {
  const nova = await p.company.findUnique({ where: { slug: "nova" } });
  const acme = await p.company.findUnique({ where: { slug: "acme" } });
  if (!nova || !acme) throw new Error("faltan empresas");

  const cat = await p.category.upsert({
    where: { id: "cat-nova-test" },
    update: {},
    create: { id: "cat-nova-test", companyId: nova.id, name: "Privada Nova", slug: "privada-nova" },
  });

  const cust = await p.customer.upsert({
    where: { id: "cust-nova-test" },
    update: {},
    create: {
      id: "cust-nova-test",
      companyId: nova.id,
      firstName: "Cliente",
      lastName: "Nova",
      documentType: "DNI",
      documentValue: "99999999",
    },
  });

  const hash = await argon2.hash("Admin123!!");
  const user = await p.user.upsert({
    where: { email: "nova-test@temp.local" },
    update: { isActive: true },
    create: { email: "nova-test@temp.local", passwordHash: hash, fullName: "Nova Test", globalRole: "USER" },
  });
  await p.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: nova.id } },
    update: { role: "COMPANY_ADMIN" },
    create: { userId: user.id, companyId: nova.id, role: "COMPANY_ADMIN" },
  });

  console.log("ACME=" + acme.id);
  console.log("NOVA=" + nova.id);
  console.log("CAT_NOVA=cat-nova-test");
  console.log("CUST_NOVA=cust-nova-test");
}

main().catch(console.error).finally(() => p.$disconnect());
```

```powershell
cd E:\Sistema_de_ventas-main\backend
$env:TS_NODE_TRANSPILE_ONLY='true'
npx ts-node -r tsconfig-paths/register -r dotenv/config prisma\_tmp-fixtures.ts
```

Guarda el `ACME=` que imprime: lo usarás como `ACME_ID`.

---

## 2. Sesiones (cookie jars)

```powershell
$B = "http://localhost:4000/api"
$ACME = Join-Path $env:TEMP "s-acme.txt"
$NOVA = Join-Path $env:TEMP "s-nova.txt"
Remove-Item $ACME,$NOVA -ErrorAction SilentlyContinue

curl.exe -s -o - -X POST "$B/auth/login" -H "Content-Type: application/json" `
  -d '{"email":"admin@acme.local","password":"Admin123!!"}' -c $ACME -b $ACME    # 200

curl.exe -s -o - -X POST "$B/auth/login" -H "Content-Type: application/json" `
  -d '{"email":"nova-test@temp.local","password":"Admin123!!"}' -c $NOVA -b $NOVA # 200
```

---

## 3. Aislamiento de tenant

### 3.1 Producto con categoría ajena → 404

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/products" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d '{"name":"HACK","costPrice":1,"salePrice":2,"stockQuantity":1,"minStock":0,"categoryId":"cat-nova-test"}'
# esperado: 404  "Category not found."
```

Control (categoría propia) → `201`:

```powershell
# primero obtén una categoría de ACME
curl.exe -s "$B/products/categories" -b $ACME -c $ACME
```

### 3.2 Producto con categoría inexistente → 404

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/products" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d '{"name":"HACK2","costPrice":1,"salePrice":2,"stockQuantity":1,"minStock":0,"categoryId":"no-existe"}'
# esperado: 404
```

### 3.3 Venta con cliente ajeno → 404

Necesitas un producto ACME con stock:

```powershell
$P = (curl.exe -s "$B/products" -b $ACME -c $ACME | ConvertFrom-Json) |
     Where-Object { $_.stockQuantity -gt 0 } | Select-Object -First 1
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/sales" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d ('{"paymentMethod":"CASH","customerId":"cust-nova-test","items":[{"productId":"'+$P.id+'","quantity":1}]}')
# esperado: 404  "Customer not found."
```

> Si da `400 Insufficient stock`, usa otro producto con stock: el chequeo de stock corre **antes** que la validación de cliente.

### 3.4 Venta con empleado inexistente → 404

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/sales" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d ('{"paymentMethod":"CASH","employeeId":"no-existe","items":[{"productId":"'+$P.id+'","quantity":1}]}')
# esperado: 404
```

### 3.5 Venta legítima → 201 (regresión del bug TDZ de `sale.saleNumber`)

```powershell
$CUST = (curl.exe -s "$B/customers" -b $ACME -c $ACME | ConvertFrom-Json)[0].id
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/sales" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d ('{"paymentMethod":"CASH","customerId":"'+$CUST+'","items":[{"productId":"'+$P.id+'","quantity":1}]}')
# esperado: 201
# ANTES de la corrección daba: 500  "Cannot access 'sale' before initialization"
```

### 3.6 Factura de venta ajena → 404

```powershell
$SALE = ((curl.exe -s "$B/sales" -b $ACME -c $ACME | ConvertFrom-Json)[0]).id

curl.exe -s -o - -w "`n%{http_code}" "$B/invoices/generate/$SALE" -b $NOVA -c $NOVA
# esperado: 404   (antes: 200 y devolvía la factura de la otra empresa)

curl.exe -s -o - -w "`n%{http_code}" "$B/invoices/generate/$SALE" -b $ACME -c $ACME
# esperado: 200   (regresión: la empresa sigue pudiendo facturar lo suyo)
```

---

## 4. Checkout: la identidad ya no viene del body

### 4.1 Sin sesión pero enviando `companyId` → 401

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests" `
  -H "Content-Type: application/json" `
  -d ('{"planCode":"START","paymentMethod":"PLIN","companyId":"'+$env:ACME_ID+'","fullName":"X","companyName":"Y","email":"spoof@example.com","password":"Password123!"}')
# esperado: 401
```

### 4.2 Invitado sin token y sin `companyId` → 201

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests" `
  -H "Content-Type: application/json" `
  -d '{"planCode":"START","paymentMethod":"PLIN","fullName":"Invitado Demo","companyName":"Empresa Demo","email":"inv-demo@example.com","password":"Password123!"}'
# esperado: 201  y cuerpo con "requestId"
```

> `YAPE` y `TRANSFER` están deshabilitados (`409 Método de pago no disponible`) y `STRIPE` da `400 ... no soportado para checkout offline`. Usa **PLIN**.

> **Nuevo (P5):** el body ya se valida con `class-validator` (whitelist activa). Campos desconocidos, email inválido o contraseña corta → `400` con la lista de errores en inglés. `paymentMethod` se normaliza a mayúsculas, así que "plin" en minúsculas **ya no** da 400 (antes el controller lo subía él mismo).
>
> ```powershell
> # campo desconocido -> 400 (whitelist)
> curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests" `
>   -H "Content-Type: application/json" `
>   -d '{"planCode":"START","paymentMethod":"PLIN","evilField":"x","fullName":"A","companyName":"B","email":"a@b.com","password":"Password123!"}'
> # esperado: 400
> ```

### 4.3 Autenticado con `companyId` propio → 201

```powershell
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests" `
  -H "Content-Type: application/json" -b $ACME -c $ACME `
  -d '{"planCode":"START","paymentMethod":"PLIN","companyId":"ACME_ID_AQUI","fullName":"Sesion","companyName":"Acme","email":"sesion-demo@example.com","password":"Password123!"}'
# esperado: 201
```

### 4.4 `proof` con `companyId` sin sesión → 401 / invitado → 201

```powershell
$REQ = ((curl.exe -s -X POST "$B/payments/checkout/requests" -H "Content-Type: application/json" `
  -d '{"planCode":"START","paymentMethod":"PLIN","fullName":"Proof Demo","companyName":"Emp Proof","email":"proof-demo@example.com","password":"Password123!"}' |
  ConvertFrom-Json).requestId)

$IMG = '"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="'

# con companyId y sin sesión -> 401
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests/$REQ/proof" `
  -H "Content-Type: application/json" -d ('{"companyId":"ACME_ID_AQUI","imageBase64":'+$IMG+'}')

# invitado legítimo -> 201
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payments/checkout/requests/$REQ/proof" `
  -H "Content-Type: application/json" -d ('{"imageBase64":'+$IMG+'}')
```

> Nota: `companyId` ya **no existe** en el DTO ⇒ si lo envías con sesión válida el validador global devuelve `400 (whitelist)`. Eso también es correcto: el identificador no viaja en el body.

---

## 5. IDOR en comprobantes (`payment-settings`)

Requiere una suscripción y un comprobante. Como con los fixtures, crea los temporales:

```ts
// dentro de _tmp-fixtures.ts o en un script aparte
const acme = await p.company.findUnique({ where: { slug: "acme" } });
const plan = await p.plan.findFirst();
const sub = await p.subscription.upsert({
  where: { id: "sub-test" },
  update: {},
  create: { id: "sub-test", companyId: acme!.id, planId: plan!.id, status: "CANCELED",
            startDate: new Date(), endDate: new Date(Date.now() - 86400000) },
});
const proof = await p.paymentProof.upsert({
  where: { id: "proof-test" },
  update: {},
  create: { id: "proof-test", subscriptionId: sub.id, imageBase64: "data:image/png;base64,AAAA",
            amount: "49.00", paymentDate: new Date() },
});
console.log("PROOF=proof-test");
```

```powershell
# dueño (ACME) -> 200
curl.exe -s -o - -w "`n%{http_code}" "$B/payment-settings/proof/proof-test" -b $ACME -c $ACME

# empresa ajena (NOVA) -> 404   (antes: 200, cualquier usuario autenticado leía el comprobante)
curl.exe -s -o - -w "`n%{http_code}" "$B/payment-settings/proof/proof-test" -b $NOVA -c $NOVA
```

---

## 6. Superficies públicas

```powershell
# ya NO es público (antes devolvía una consulta a la BD)
curl.exe -s -o - -w "`n%{http_code}" "$B/sales/test"        # esperado: 401

# sigue público por diseño
curl.exe -s -o - -w "`n%{http_code}" "$B/health/live"        # 200
curl.exe -s -o - -w "`n%{http_code}" "$B/plans"              # 200
```

### 6.1 Comprobantes de pago requieren sesión (P7)

Usa la suscripción `sub-test` y el comprobante `proof-test` de la sección 5:

```powershell
# sin token -> 401  (antes 200)
curl.exe -s -o - -w "`n%{http_code}" "$B/payment-settings/proof/subscription/sub-test"

# empresa ajena (NOVA) -> 404
curl.exe -s -o - -w "`n%{http_code}" "$B/payment-settings/proof/subscription/sub-test" -b $NOVA -c $NOVA

# dueño (ACME) -> 200
curl.exe -s -o - -w "`n%{http_code}" "$B/payment-settings/proof/subscription/sub-test" -b $ACME -c $ACME

# subir comprobante a suscripción ajena -> 404
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/payment-settings/proof/sub-test" `
  -b $NOVA -c $NOVA -H "Content-Type: application/json" `
  -d ('{"imageBase64":'+'"data:image/png;base64,AAAA"'+',"amount":"49.00"}')
```

---

## 7. Errores HTTP y filtro global

```powershell
# login -> 200 (antes 201)
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/auth/login" -H "Content-Type: application/json" `
  -d '{"email":"admin@acme.local","password":"Admin123!!"}' -c $ACME

# registro duplicado -> 409 (P2002) en vez de 500
# entidad inexistente -> 404 (P2025)
# FK violada -> 409 (P2003)
curl.exe -s -o - -w "`n%{http_code}" -X POST "$B/products" -H "Content-Type: application/json" `
  -b $ACME -c $ACME -d '{"name":"FK","costPrice":1,"salePrice":2,"stockQuantity":1,"minStock":0,"categoryId":"no-existe"}'
# esperado: 404 (categoria) o 409 si es P2003 según el camino
```

Los mensajes de 5xx no deben exponer detalle interno en producción (el filtro lo oculta y loguea el stack).

---

## 8. Migraciones, FKs y seeds

```powershell
cd E:\Sistema_de_ventas-main\backend

npx prisma migrate status          # -> "Database schema is up to date!"
npx prisma migrate diff --from-config-datasource --to-schema --exit-code   # -> exit 0

# Nº de FKs reales (esperado: 37)
npx ts-node -r tsconfig-paths/register -r dotenv/config -e "require('dotenv/config');const{PrismaPg}=require('@prisma/adapter-pg');const{PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}})});const r=await p.\$queryRawUnsafe(\"select count(*)::int n from pg_constraint where contype='f'\");console.log(r);await p.\$disconnect();})();"

# seeds idempotentes
npm run db:seed            # catálogo, no borra nada
npm run db:seed            # correrlo 2a vez: sin cambios
```

### Integridad FK (esperados)

| Acción | Esperado |
|--------|----------|
| Insertar producto con `categoryId` inexistente vía SQL | error FK (P2003) |
| Borrar categoría con productos | bloqueado (RESTRICT) o `SET NULL` según tabla |
| Borrar plan referenciado por suscripción | bloqueado (P2003) |
| Borrar empresa | cascade → 0 filas en tablas hijas |
| Insertar valor de enum inválido | bloqueado |

---

## 9. Limpieza (obligatoria)

Borra los fixtures para no dejar residuos:

```ts
// prisma/_tmp-cleanup.ts
await p.paymentProof.deleteMany({ where: { subscription: { company: { slug: "acme" } } } });
await p.subscription.deleteMany({ where: { company: { slug: "acme" } } });
await p.checkoutRequest.deleteMany({ where: { email: { endsWith: "@example.com" } } });
await p.sale.deleteMany({});
await p.product.deleteMany({ where: { name: { in: ["HACK", "HACK2", "FK"] } } });
await p.customer.deleteMany({ where: { documentValue: "99999999" } });
await p.category.deleteMany({ where: { id: "cat-nova-test" } });
const u = await p.user.findUnique({ where: { email: "nova-test@temp.local" } });
if (u) {
  await p.membership.deleteMany({ where: { userId: u.id } });
  await p.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {});
  await p.user.delete({ where: { id: u.id } });
}
```

Estado baseline esperado:

```
companies=2 users=5 memberships=3 products=2 categories=2
customers=2 sales=0 subs=0 proofs=0 checkout=0 plans=4 employees=3
```

```powershell
Remove-Item E:\Sistema_de_ventas-main\backend\prisma\_tmp-*.ts
```

---

## 10. Suite de tests unitarios (P3)

La suite usa el runner nativo de Node 22 (`node:test`) + `ts-node`; **no instala jest/supertest**. Corre en ~1-4 min en esta máquina.

```powershell
cd E:\Sistema_de_ventas-main\backend
npm test                # esperado: 23 tests, 0 failures
```

Cubre (mocks manuales, sin BD):

| Suite | Verifica |
|-------|----------|
| `TenantGuard` | Superadmin sin `companyId` → 403; con `companyId` scopes; miembro de empresa suspendida → 403 |
| `OptionalJwtAuthGuard` | Con sesión → usuario; sin sesión → `null` (no lanza) |
| `ProductsService.ensureCategory` | `where` incluye `companyId`; categoría ajena → NotFound |
| `InvoicesService.generateInvoiceHtml` | Venta ajena → 404; propia → HTML |
| `PaymentSettingsService` | `getProofById`/`uploadPaymentProof` con suscripción ajena → 404 |
| `CheckoutRequestsController` | Spoof de `companyId` sin sesión → 401; `companyId` de sesión inyectado; `review` usa `user.sub` |
| `SalesService.createSale` | Regresión TDZ; producto de otra empresa → not found |

---

## 11. Checklist rápido

- [ ] `prisma migrate status` → up to date
- [ ] `prisma migrate diff --exit-code` → 0
- [ ] 37 FKs activas
- [ ] login → 200
- [ ] producto con categoría ajena → 404
- [ ] venta con cliente ajeno → 404
- [ ] venta legítima → 201
- [ ] factura ajena → 404 / propia → 200
- [ ] checkout invitado → 201
- [ ] checkout con `companyId` sin sesión → 401
- [ ] checkout con campo desconocido → 400 (whitelist)
- [ ] proof con `companyId` sin sesión → 401
- [ ] proof de empresa ajena → 404
- [ ] `GET /payment-settings/proof/subscription/:id` sin token → 401
- [ ] `/api/sales/test` → 401
- [ ] `npm test` (backend) → 23/23
- [ ] `npm run lint` (frontend) → 0
- [ ] `tsc --noEmit` + `npm run build` (backend) → 0
