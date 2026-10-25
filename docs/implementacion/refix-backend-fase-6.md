# Refix backend — Fase 6

Rama: `refix/backend-fase-6`, creada desde la Fase 5 (`e540703`).

Alcance: B-21, B-22, B-23 y B-24 del informe técnico backend del 23 de octubre de 2026. Esta fase cierra el bloque backend de 24 hallazgos.

## B-21 — Contrato de errores públicos

- `backend/src/common/filters/public-error-details.ts` define una lista permitida de metadatos públicos: `limit`, `used`, `remaining`, `current`, `resource`, `currentPlan`, `requiredPlan`, `planName`, `period`, `upgradeUrl`, `modules` y `features`.
- Los números deben ser enteros seguros (`limit` admite `-1` para "ilimitado"; el resto no admite negativos). Los textos están acotados en longitud y rechazan caracteres de control. `period` debe tener formato `YYYY-MM`. `upgradeUrl` solo admite rutas internas (`/...`) sin `//`. `modules` y `features` son listas acotadas de identificadores.
- `AllExceptionsFilter` incorpora esos detalles al cuerpo de error **solo para respuestas menores a 500**. Un 5xx no expone metadatos de la excepción interna.
- El filtro no devuelve el objeto de excepción completo: cualquier campo fuera de la lista permitida se descarta, incluidos `passwordHash`, `cause`, `stack` y datos internos.
- La cobertura incluye pruebas unitarias del filtro y una prueba HTTP real que atraviesa guard, filtro y serialización.

## B-22 — Dependencias

Actualizadas y verificadas con `npm audit`:

| Paquete | Versión |
| --- | --- |
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing` | `^11.2.8` |
| `@nestjs/swagger` | `^11.4.7` |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | `7.10.1` exacto |
| `express` | `5.2.1` exacto |
| `@types/express` | `^5.0.6` |
| `mercadopago` | `^3.6.1` |
| `nodemailer` | `^10.2.1` |
| `@types/nodemailer` | `^8.0.2` |
| `zod` | `^4.6.7` |
| `@electric-sql/pglite` (solo pruebas) | `^0.5.11` |

`express` queda en una sola instancia: Nest 11 usa Express 5 y la versión fijada coincide con la que declara `@nestjs/platform-express`, evitando la duplicación anterior entre Express 4 y 5.

Se añadieron `overrides` acotados para dependencias transitivas con avisos:

- `exceljs` → `uuid@^11.1.1`
- `@nestjs/platform-express` → `multer@^2.5.0`
- `@nestjs/swagger` → `js-yaml@^5.5.0`

Resultado de `npm audit`: **0 vulnerabilidades** en el árbol instalado. Se ejecutó además una prueba de compatibilidad de Zod 4 (valores por defecto, coerción y booleanos de entorno) y de Nodemailer 10 (construcción de mensaje con `Message-ID` estable sin contacto SMTP real).

El resultado limpio de `npm audit` describe el árbol instalado; no sustituye un análisis de alcanzabilidad de cada aviso histórico del informe.

## B-23 — Identificadores de cambio de plan

- `EntityIdPipe` ya estaba alineado en la Fase 3 con los identificadores CUID generados por Prisma en subida de comprobante y revisión de empresa/plataforma.
- La Fase 6 añade una prueba HTTP de extremo a extremo que usa el identificador **devuelto por la creación** (no un UUID sintético), envía el comprobante y ejecuta las dos rutas de revisión. También comprueba que el pipe real rechaza sintaxis inválida con 400.
- La revisión conserva el ciclo de facturación almacenado (por ejemplo anual) en lugar del ciclo actual del plan.

## B-24 — Contrato y default de plantillas de factura

- La creación persiste `content = "STRUCTURED_V1"`, satisface el campo obligatorio del modelo y deja de usar `any` en el input de Prisma.
- `isDefault` se guarda en el mismo alta y el cambio de predeterminada se realiza dentro de una transacción `Serializable` con reintento ante `P2034`.
- El desmarcado de la plantilla anterior se limita al mismo ámbito: `companyId` + `isGlobal`. Una plantilla de empresa no altera la predeterminada global ni la de otra empresa.
- `update` y `remove` resuelven la plantilla con visibilidad estricta: plantillas de empresa solo con contexto de esa empresa y plantillas globales solo cuando `isGlobal` es verdadero y `companyId` es nulo.
- `InvoicesController` deja de aplicar `TenantGuard` a toda la clase. Las rutas de generación, plantilla por defecto y creación con empresa mantienen el guard por ruta; la gestión de plantillas globales queda disponible para `SUPER_ADMIN` sin contexto de tenant. El `companyId` se toma de la sesión, no del cliente.
- El DTO distingue campos opcionales anulables (`description`, `logoUrl`, textos y `customFields`) de campos obligatorios que no admiten `null` (`name`, `type`, toggles, `taxPercentage`, tipografía, papel e `isDefault`). `name` exige entre 1 y 200 caracteres. `taxPercentage: 0` se conserva. `content` no se acepta desde el cliente.
- La migración `20261104000000_invoice_template_defaults` normaliza predeterminadas duplicadas con un orden determinista (`is_active`, `updated_at`, `id`) y crea índices únicos parciales para el default de empresa y el default global.

### Corrección adicional detectada por la prueba de integración

La consulta financiera de la Fase 5 referenciaba `"saleNumber"` como columna SQL. El historial de migraciones crea `sale_number`, por lo que el `UNION ALL` habría fallado en una base creada desde cero. Se corrigió `finance-query.helper.ts` para usar `sale_number` sin cambiar el alias de la proyección. Las pruebas de Fase 5 usaban repositorios simulados y no detectaron esta discrepancia.

## Migración preparada

`backend/prisma/migrations/20261104000000_invoice_template_defaults/migration.sql`:

1. Deduplica plantillas predeterminadas por ámbito.
2. Crea `invoice_templates_one_company_default` (índice único parcial por empresa).
3. Crea `invoice_templates_one_global_default` (índice único parcial global).

**No fue aplicada a la base compartida.** Siguen pendientes de despliegue `20261102000000_inventory_refund_upgrade_integrity`, `20261103000000_transactional_effects` y esta migración.

## Verificación

Ejecutado desde `backend`:

```text
npx prisma validate
npx prisma generate
npm run lint
npm run build
node node_modules/prettier/bin/prettier.cjs --check <archivos modificados>
node -r ts-node/register -r tsconfig-paths/register --test --test-concurrency=2 "src/**/*.spec.ts"
npm audit
git diff --check
```

Resultado: **311 pruebas aprobadas en 89 suites, 0 fallos**; 15 pruebas nuevas respecto a la Fase 5. Lint, build, formato, validación de Prisma y auditoría de dependencias aprobados.

La prueba `migration-integrity.spec.ts` ejecuta el historial completo de migraciones en PostgreSQL embebido (PGlite), siembra datos y aplica la migración final. Comprueba:

- Deduplicación determinista de defaults y existencia de tablas de fases previas.
- Violación del índice único al insertar un segundo default global.
- Rollback de una transacción al faltar un campo obligatorio.
- Paginación financiera más allá de la antigua barrera de 500 filas (1205 ventas).
- Resumen por moneda, tenant y estado, excluyendo ventas canceladas/devueltas y otras empresas.
- Búsqueda hostil parametrizada sin alterar el esquema.

PGlite no sustituye una prueba contra el PostgreSQL de integración ni una prueba de concurrencia multi-proceso. Tampoco se ejecutaron entrega SMTP real, sandbox de MercadoPago, reconexión SSE en navegador ni migraciones sobre la base compartida.

## Cierre

Con esta fase quedan tratados B-01 a B-24 en commits locales por fase. No se hizo push ni se aplicaron migraciones a la base compartida. El siguiente bloque corresponde a los hallazgos del frontend (F-01 a F-16).
