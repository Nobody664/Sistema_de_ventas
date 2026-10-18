# Glosario de dominio: Usuario, Empleado y Cliente

> Documento de referencia para evitar la ambigüedad del término "usuario".
> Define qué es cada concepto, cómo se relacionan, cómo se cuentan y por qué los
> planes (FREE, START, GROWTH, SCALE) los habilitan de forma distinta.

## 1. Objetivo

En el lenguaje cotidiano llamamos "usuario" a tres cosas distintas del sistema.
Esta confusión produce preguntas como:

> "Si en el plan FREE puedo crear clientes, ¿por qué no puedo crear empleados?"

La respuesta es que **cliente**, **empleado** y **usuario** son **conceptos de
dominio diferentes**, no tres formas de decir lo mismo. Este documento fija la
definición oficial y la lógica que la acompaña.

## 2. Los tres conceptos

| Concepto | Modelo Prisma | ¿Inicia sesión? | ¿Interno o externo? | Definición |
|----------|---------------|-----------------|---------------------|------------|
| **Usuario** (cuenta de acceso) | `User` + `Membership` | Sí (email + contraseña) | Interno | Credencial de acceso al sistema, vinculada a una empresa mediante una `Membership` con un `role`. |
| **Empleado** | `Employee` | Hoy sí (se le crea cuenta) | Interno | Ficha de personal/vendedor de la empresa. Puede o no tener cuenta de usuario (`userId` es opcional en el schema). |
| **Cliente** | `Customer` | No | Externo | Comprador / contraparte comercial de la empresa. Nunca accede al sistema. |

Referencias del schema: `backend/prisma/schema.prisma` → `User` (`:188`),
`Membership` (`:321`), `Employee` (`:478`), `Customer` (`:338`).

## 3. Ejes de distinción

Dos preguntas separan los conceptos sin ambigüedad:

1. **¿Puede iniciar sesión en el sistema?**
   - Sí → **Usuario** (y, hoy, también **Empleado**).
   - No → **Cliente**.
2. **¿Es gente de mi empresa o de afuera?**
   - Interno → **Usuario** / **Empleado**.
   - Externo → **Cliente**.

Regla mental rápida:

```
¿Puede entrar al sistema? → Usuario
¿Es mi gente?             → Empleado
¿Me compra?               → Cliente
```

## 4. Relaciones en el modelo

```
Company 1 ──< Membership >── 1 User
   │             (role)
   │
   ├──< Employee ──?── 1 User   (userId opcional)
   │
   └──< Customer               (sin User)
```

- Un **User** puede pertenecer a **varias empresas** (una `Membership` por empresa).
  La `Membership` es la que da el **rol dentro de la empresa**.
- Un **Employee** pertenece a **una empresa** y apunta opcionalmente a un **User**
  (`@@unique([userId])`).
- Un **Customer** pertenece a una empresa y **no** se relaciona con `User`.

## 5. Cómo se cuentan (límites por plan)

Los límites viven en `backend/src/common/guards/subscription-limit.service.ts`
(`getSubscriptionLimits`, `:29-40`) y en `backend/prisma/seed.ts`.

| Recurso | Qué cuenta | Fórmula | FREE | START | GROWTH | SCALE |
|---------|-----------|---------|------|-------|--------|-------|
| `users` | filas de `memberships` activas | `maxUsers` | 1 | 3 | 10 | 999 |
| `employees` | filas de `employees` | `maxUsers` (comparte tope) | 1 | 3 | 10 | 999 |
| `products` | filas de `products` | `maxProducts` | 50 | 500 | 5000 | 999999 |
| `customers` | filas de `customers` | `maxProducts × 5` | 250 | 2500 | 25000 | ~5.000.000 |
| `categories` | filas de `categories` | `max(1, floor(maxProducts / 20))` | 2 | 25 | 250 | 49999 |

Puntos clave:

- **`users` cuenta `memberships`, no `employees`.** Son contadores distintos
  (`getCurrentCounts`, `:42-67`).
- **`employees` y `users` comparten el mismo tope** (`maxEmployees = maxUsers`).
- **`customers` es un recurso de volumen**, no de "acceso": escala con el catálogo.

## 6. Por qué FREE tiene clientes pero no empleados

No es una inconsistencia: son **ejes de producto distintos**.

- **Cliente = núcleo de vender.** Todo negocio necesita registrar a quién le vende,
  por eso el módulo `customers` es **base** y está incluido en FREE.
- **Empleado = gestión organizacional** (staff, roles, cuentas de acceso).
  Es un módulo **de pago** (START+). Además FREE tiene `maxUsers: 1`
  (solo la cuenta del dueño).

Módulos por plan (resultado de las migraciones
`20261014041000_backfill_plan_capabilities`,
`20261014043000_remove_payments_plan_module`,
`20261014044000_free_plan_reports_module`):

| Módulo | FREE | START | GROWTH | SCALE |
|--------|:----:|:-----:|:------:|:-----:|
| dashboard, notifications | ✅ | ✅ | ✅ | ✅ |
| products, categories, inventory, sales, customers, reports | ✅ | ✅ | ✅ | ✅ |
| distributors, employees | ❌ | ✅ | ✅ | ✅ |
| api | ❌ | ❌ | ✅ | ✅ |
| api_search_dni, webhooks | ❌ | ❌ | ❌ | ✅ |

Permisos (features) destacados:

| Feature | FREE | START | GROWTH | SCALE |
|---------|:----:|:-----:|:------:|:-----:|
| reports.basic, sales.discounts | ✅ | ✅ | ✅ | ✅ |
| reports.export, inventory.kardex | ❌ | ✅ | ✅ | ✅ |
| reports.advanced, inventory.batches, inventory.multi_branch, api.access | ❌ | ❌ | ✅ | ✅ |
| api.dni_search, webhooks.manage, users.manage | ❌ | ❌ | ❌ | ✅ |

El gating se aplica con decoradores en los controladores:

- `@RequireModule('customers')` → `backend/src/modules/customers/customers.controller.ts:14`
- `@RequireModule('employees')` → `backend/src/modules/employees/employees.controller.ts:14`

## 7. Estado actual de la implementación

Es importante conocer este detalle al hablar de "empleados":

> **Hoy, crear un empleado siempre crea un `User` + `Membership` + `Employee`**
> en una sola transacción (`backend/src/modules/employees/employees.service.ts:50-96`).

Consecuencias:

- En este sistema, "Empleado" = **cuenta de acceso + ficha de personal**.
- **No existe todavía** el modo "empleado sin acceso", aunque el schema ya lo
  permite (`Employee.userId` es opcional).
- Al eliminar un empleado se revoca/elimina su `Membership` y se hace soft-delete
  de la ficha (`employees.service.ts:140-207`).
- La feature `users.manage` está **declarada solo para SCALE** en
  `plan-capabilities.constants.ts:30`, pero **aún no se aplica** a ningún controlador.

## 8. Glosario oficial de términos

| Término | Uso correcto | Evitar |
|---------|--------------|--------|
| **Usuario** | Persona con credencial de acceso (`User` + `Membership`). | Usarlo para clientes o para empleados sin cuenta. |
| **Empleado** | Ficha interna de personal de la empresa (`Employee`). | Llamarlo "usuario" cuando hablamos de staff. |
| **Cliente** | Comprador externo (`Customer`). | Decir "usuario" para un comprador. |
| **Miembro** | La relación `User ↔ Company` con su rol (`Membership`). | Confundir "miembro" con "dueño". |
| **Cuenta** | Sinónimo de **Usuario** (credencial). | "Cuenta" para referirse a la empresa. |

## 9. Pendientes / decisiones abiertas

1. **Empleado sin acceso**: implementar creación de `Employee` sin `User`
   (aprovechando `userId` opcional) y separar `maxUsers` de `maxEmployees`.
2. **Aplicar `users.manage`**: hacer efectiva la feature de SCALE en la gestión de
   cuentas y alinear la matriz de planes.
3. **Textos de UI**: asegurar que las etiquetas de la interfaz usen consistentemente
   "Usuario", "Empleado" y "Cliente" según este glosario.
