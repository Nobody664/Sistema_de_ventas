# Plan de Implementación: Rol de Cajero (CASHIER)

## 1. Análisis del Sistema Actual

### 1.1 Estado Actual de Permisos

El esquema actual de roles en Prisma (`schema.prisma:55-60`):
```prisma
enum CompanyRole {
  COMPANY_ADMIN  // Administrador total
  MANAGER      // Gestor con permisos elevados
  CASHIER      // Cajero/Vendedor
  STAFF        // Personal básico
}
```

#### Permisos Actuales por Rol

| Módulo | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|--------|--------|-------|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| POS (Ventas) | - | - | ✓ | - |
| Caja | ✓ | ✓ | ✓ | - |
| Productos | ✓ | ✓ | ✓ | ✓ |
| Inventario | ✓ | ✓ | - | - |
| Proveedores | ✓ | - | - | - |
| Categorías | ✓ | ✓ | - | - |
| Ventas | ✓ | ✓ | ✓ | - |
| Reportes | ✓ | ✓ | - | - |
| Clientes | ✓ | ✓ | - | - |

### 1.2 Servicios Backend con Restricciones

#### CashService (`cash.service.ts:23-39, 41-93, 95-138`)
- `getCurrentSession`: Restringido a propia sesión si CASHIER
- `openSession`: Restringido a propia sesión si CASHIER
- `addMovement`: Restringido a propia sesión si CASHIER
- `closeSession`: Restringido a propia sesión si CASHIER
- `getSessionSummary`: Restringido a propia sesión si CASHIER

#### SalesService (`sales.service.ts:14-36`)
- `findRecentSales`: Restringido a propias ventas si CASHIER
- `findById`: Restringido a propias ventas si CASHIER
- `createSale`: Requiere que el empleado tenga `userId` vinculado

#### Lógica de restricción (`cash.service.ts:1035-1037`):
```typescript
private isPrivilegedRole(roles: string[]) {
  return roles.includes('COMPANY_ADMIN') || roles.includes('MANAGER');
}
```

---

## 2. Requisitos del Rol Cajero

### 2.1 Funcionalidades Permitidas

#### ✅ PERMITIDO: Gestión Personal
| Funcionalidad | Descripción |
|-------------|------------|
| Editar perfil propio | Nombre, teléfono, avatar, contraseña |
| Ver información de empresa | Solo lectura (datos de la empresa) |

#### ✅ PERMITIDO: Gestión de Caja
| Funcionalidad | Descripción |
|-------------|------------|
| Abrir caja | Con monto de apertura |
| Cerrar caja | MANUAL (solo acción del cajero) |
| Agregar movimientos | Ingresos/egresos manuales |
| Arqueo de caja | Registro de conteo |
| Ver estado de caja | Solo su sesión |

#### ✅ PERMITIDO: Ventas y Clientes
| Funcionalidad | Descripción |
|-------------|------------|
| Registrar ventas | Desde POS |
| Ver clientes | Solo lectura |
| Imprimir boletas | Tickets de venta |
| Ver historial de ventas propias | Solo sus ventas |

#### ✅ PERMITIDO: Reportes
| Funcionalidad | Descripción |
|-------------|------------|
| Reporte diario general | Todos los totales del día |
| Impresión de reporte | Todos los métodos de pago |

### 2.2 Funcionalidades NO Permitidas

#### ❌ PROHIBIDO: Administración del Sistema
| Funcionalidad | Justificación |
|-------------|---------------|
| Editar empresa | Solo COMPANY_ADMIN |
| Gestionar usuarios | Solo COMPANY_ADMIN |
| Gestionar empleados | Solo COMPANY_ADMIN/MANAGER |
| Gestionar planes | Solo COMPANY_ADMIN |
| Configuración de pagos | Solo COMPANY_ADMIN |

#### ❌ PROHIBIDO: Gestión de Inventario
| Funcionalidad | Justificación |
|-------------|---------------|
| Crear productos | Solo COMPANY_ADMIN/MANAGER |
| Editar productos | Solo COMPANY_ADMIN/MANAGER |
| Movimientos de inventario | Solo COMPANY_ADMIN/MANAGER |
| Proveedores | Solo COMPANY_ADMIN |

#### ❌ PROHIBIDO: Análisis y Reportes Avanzados
| Funcionalidad | Justificación |
|-------------|---------------|
| Ver auditoría | Solo COMPANY_ADMIN/MANAGER |
| Reportes avanzados | Solo COMPANY_ADMIN/MANAGER |
| Gestión de categorías | Solo COMPANY_ADMIN/MANAGER |

---

## 3. Diseño UX para el Perfil de Cajero

### 3.1 Navegación (Sidebar)

```typescript
// companyItems para CASHIER
const companyItems = [
  { label: 'POS', href: '/pos', icon: ShoppingCart, roles: ['CASHIER'] },
  { label: 'Caja', href: '/cash', icon: Wallet, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Ventas', href: '/sales', icon: ShoppingCart, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER'] },
  { label: 'Productos', href: '/products', icon: Package, roles: ['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] },
];
```

**Nota**: Se REMUEVE del menú para CASHIER:
- Inventario
- Proveedores
- Categorías
- Reportes

### 3.2 Estructura de Página de Perfil

```
┌─────────────────────────────────────────────────────┐
│  MI PERFIL - CAJERO                                │
├─────────────────────────────────────────────────────┤
│  [Avatar]  Nombre del Cajero                       │
│          Rol: Cajero                             │
│          Editar perfil                        [→] │
├─────────────────────────────────────────────────────┤
│  MI INFORMACIÓN                                  │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │ Nombre: Juan     │  │ Teléfono: 999999  │    │
│  └──────────────────┘  └──────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │ Email: juan@empresa.com                  │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│  INFORMACIÓN DE LA EMPRESA (SOLO LECTURA)          │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │ Empresa: MiTienda│  │ RUC: 20123456789  │    │
│  └──────────────────┘  └──────────────────┘    │
│  [Editar] <--- BOTÓN OCULTO PARA CASHIER        │
└─────────────────────────────────────────────────────┘
```

### 3.3 Diseño de Caja UX - Enfoque Minimalista

```typescript
// Diseño propuesto para cash-client.tsx
// Tema: Minimalista, orientado a acción rápida
```

```
┌──────────────────────────────────────────────────────────┐
│  🏪 CAJA - TURNO ACTIVO                              │
│  Estado: ABIERTA · Apertura: S/ 100.00                 │
├──────────────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────┐   ┌────────────────┐         │
│  │ VENTAS HOY     │   │ EFECTIVO EN CAJA│         │
│  │ S/ 1,250.00   │   │ S/ 850.00      │         │
│  └────────────────┘   └────────────────┘         │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ ACCIONES RÁPIDAS                       │     │
│  │ [Abrir Caja] [Ingreso] [Egreso] [Cerrar]│     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ ARQUEO DE CAJA                        │     │
│  │ [Monto Contado: _______] [Registrar]   │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
├──────────────────────────────────────────────────────────┤
│  📊 RESUMEN DEL DÍA                             │
│  ┌─────────────────────────────────────────┐     │
│  │ Efectivo:   S/ 850.00  (12 ventas)      │     │
│  │ Yape:      S/ 200.00  (3 operaciones)    │     │
│  │ Transfer:  S/ 150.00  (2 operaciones)   │     │
│  │ Tarjeta:   S/ 50.00    (1 venta)        │     │
│  ─────────────────────────────────────────  │     │
│  │ TOTAL:     S/ 1,250.00                 │     │
│  └─────────────────────────────────────────┘     │
│  [Imprimir Reporte]                              │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Componentes UX Específicos

#### A. Panel de control de caja
- Estado visual claro (ABIERT/CERRADO)
- Acciones principales sin submenús
- Resumen financiero en tiempo real

#### B. Modal de apertura de caja
```
┌─────────────────────────────────┐
│  ABRIR CAJA                    │
│  ───────────────────────────    │
│  Monte de apertura:           │
│  [S/ 100.00]              │
│  ─────────────────────────  │
│  [Cancelar] [Abrir Caja]     │
└─────────────────────────────────┘
```

#### C. Modal de cierre de caja
```
┌─────────────────────────────────────────────┐
│  CERRAR CAJA                              │
│  ──────────────────────────────────────  │
│  Esperado: S/ 850.00                      │
│  Monte de cierre: [_____________]        │
│  Diferencia: S/ +50.00                    │
│  Motivo de diferencia: [_____________]    │
│  ──────────────────────────────────────  │
│  [Cancelar] [Cerrar Caja]                │
└─────────────────────────────────────────────┘
```

#### D. Arqueo visual
```
┌─────────────────────────────────────┐
│  ARQUEO DE CAJA                     │
│  ───────────────────────────────    │
│  Tipo: [Parcial ▼]                │
│  Monte contabilizado: [S/ __]      │
│  Esperado: S/ 850.00               │
│  Diferencia: S/ +25.00            │
│  ───────────────────────────────  │
│  [Cancelar] [Registrar Arqueo]    │
└─────────────────────────────────────┘
```

### 3.5 Flujo de Sesión de Caja

```
                    ┌─────────────────┐
                    │ USUARIO LOGIN   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ HAY CAJA ABIERTA│             │ NO HAY CAJA     │
    │ (del cajero)   │             │ ABIERTA         │
    └────────┬────────┘             └────────┬────────┘
             │                              │
             ▼                    ┌────────▼────────┐
    ┌─────────────────┐         │ MOSTRAR BOTÓN    │
    │ Mostrar Panel   │         │ "ABRIR CAJA"    │
    │ de Controle    │         └────────┬────────┘
    │ (estado,       │                  │
    │  movimientos, │                  ▼
    ��  arqueo)      │         ┌─────────────────┐
    │               │         │ Usuario ingresa │
    └────────┬────────┘         │ monto apertura  │
             │                └────────┬────────┘
             │                         │
    ┌────────▼────────┐              ▼
    │ Cajero hace   │       ┌─────────────────┐
    │ LOGOUT       │       │ SE CREA SESIÓN   │
    │ (sesión     │       │ DE CAJA        │
    │  NO se     │       │ ABIERTA        │
    │  cierra)    │       └─────────────────┘
    └─────────────┘
```

**Punto clave**: La sesión de caja NO se cierra cuando el cajero hace logout. Solo se cierra:
1. Manualmente desde el botón "Cerrar caja"
2. Por un administrador del sistema

---

## 4. Implementation Plan

### 4.1 Modificaciones en Sidebar (Frontend)

**Archivo**: `frontend/components/layout/app-sidebar.tsx`

```typescript
// Remover para CASHIER
- { label: 'Inventario', href: '/inventory', ... }  // NO para CASHIER
- { label: 'Proveedores', ... }                   // NO para CASHIER
- { label: 'Categorías', ... }                  // NO para CASHIER
- { label: 'Reportes', ... }                    // NO para CASHIER
```

### 4.2 Modificaciones en Perfil (Frontend)

**Archivo**: `frontend/components/profile/profile-client.tsx`

```typescript
// Ocultar botón de editar empresa para CASHIER
const canManageCompany = roles.includes('COMPANY_ADMIN') || roles.includes('MANAGER');

// En el template:
{canManageCompany ? (
  <Link href="/settings/company">Editar</Link>
) : null}
// CASHIER solo ve el botón de editar SU PERFIL personal
```

### 4.3 Refactorización de Cash Client (Frontend)

**Archivo existente**: `frontend/app/(dashboard)/cash/cash-client.tsx`

**Cambios necesarios**:
1. Simplificar UI para rol CASHIER
2. Ocultar funciones de Manager (conciliación Yape, revisión de arqueos)
3. Agregar impresión de reporte diario
4. Mejorar diseño visual

### 4.4 Impresión de Reporte Diario

**Endpoint**: `/cash/report/daily/export`

**Para CASHIER**: Genera reporte general con:
- Todos los métodos de pago
- Total general del día
- Datos del cajero (propias ventas)

```html
<!-- Formato de impresión -->
<html>
<head>
  <style>
    @media print {
      body { font-family: Arial; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>REPORTE DIARIO DE VENTAS</h1>
  <p>Fecha: {fecha}</p>
  <p>Cajero: {nombre}</p>
  <table>
    <tr><th>Método</th><th>Cantidad</th><th>Monto</th></tr>
    <tr><td>Efectivo</td><td>15</td><td>S/ 850.00</td></tr>
    <tr><td>Yape</td><td>3</td><td>S/ 200.00</td></tr>
    <tr><td>Transferencia</td><td>2</td><td>S/ 150.00</td></tr>
    <tr><td>Tarjeta</td><td>1</td><td>S/ 50.00</td></tr>
    <tr style="font-weight:bold"><td>TOTAL</td><td>21</td><td>S/ 1,250.00</td></tr>
  </table>
</body>
</html>
```

---

## 5. Matriz de Permisos Final

### 5.1 Frontend - Rutas Accesibles

| Ruta | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|-----|-------------|--------|--------|-------|
| `/dashboard` | ✓ | ✓ | ✓ | ✓ |
| `/pos` | ✓ | ✓ | ✓ | - |
| `/cash` | ✓ | ✓ | ✓ | - |
| `/products` | ✓ | ✓ | ✓ | ✓ |
| `/inventory` | ✓ | ✓ | - | - |
| `/suppliers` | ✓ | - | - | - |
| `/categories` | ✓ | ✓ | - | - |
| `/sales` | ✓ | ✓ | ✓ | - |
| `/reports` | ✓ | ✓ | - | - |
| `/customers` | ✓ | ✓ | ✓ | - |
| `/profile` | ✓ | ✓ | ✓ | ✓ |
| `/profile/edit` | ✓ | ✓ | ✓ | ✓ |
| `/company` | ✓ | ✓ | R | - |
| `/company/edit` | ✓ | - | - | - |
| `/subscription` | ✓ | - | - | - |
| `/employees` | ✓ | ✓ | - | - |
| `/settings/*` | ✓ | - | - | - |

### 5.2 Backend - Endpoints Accesibles

| Endpoint | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|----------|-------------|--------|--------|-------|
| `GET /cash/session/current` | ✓ | ✓ | ✓ (propia) | - |
| `POST /cash/session/open` | ✓ | ✓ | ✓ | - |
| `POST /cash/session/{id}/close` | ✓ | ✓ | ✓ (propia) | - |
| `POST /cash/session/{id}/movements` | ✓ | ✓ | ✓ (propia) | - |
| `POST /cash/session/{id}/count-audits` | ✓ | ✓ | ✓ (propia) | - |
| `GET /cash/session/{id}/summary` | ✓ | ✓ | ✓ (propia) | - |
| `GET /cash/report/daily` | ✓ | ✓ | ✓ | - |
| `GET /cash/report/daily/export` | ✓ | ✓ | ✓ | - |
| `PATCH /cash/yape/{id}/status` | ✓ | ✓ | - | - |
| `GET /cash/session/reviews/pending` | ✓ | ✓ | - | - |
| `PATCH /cash/session/{id}/review` | ✓ | ✓ | - | - |
| `PATCH /cash/count-audits/{id}/review` | ✓ | ✓ | - | - |
| `GET /sales` | ✓ | ✓ | ✓ (propias) | - |
| `POST /sales` | ✓ | ✓ | ✓ | - |
| `GET /sales/{id}` | ✓ | ✓ | ✓ (propia) | - |
| `GET /customers` | ✓ | ✓ | ✓ | - |
| `GET /products` | ✓ | ✓ | ✓ | ✓ |
| `POST /products` | ✓ | ✓ | - | - |
| `PUT /products/{id}` | ✓ | ✓ | - | - |
| `GET /employees` | ✓ | ✓ | - | - |
| `POST /employees` | ✓ | ✓ | - | - |

---

## 6. Resumen de Cambios Requeridos

### 6.1 Frontend

| Archivo | Cambio | Prioridad |
|---------|--------|---------|
| `app-sidebar.tsx` | Remover rutas no autorizadas | ALTA |
| `profile-client.tsx` | Ocultar editar empresa para CASHIER | ALTA |
| `cash-client.tsx` | Rediseñar UI para CASHIER | ALTA |
| `cash-client.tsx` | Agregar impresión de reporte | MEDIA |
| `pos-client.tsx` | Verificar acceso correcto | MEDIA |

### 6.2 Backend

| Archivo | Cambio | Prioridad |
|---------|--------|---------|
| `cash.service.ts` | Verificar lógica de restricción | ALTA |
| `sales.service.ts` | Verificar acceso a clientes | MEDIA |

---

## 7. Casos de Uso

### 7.1 Caso 1: Cajero inicia turno

```
1. Cajero inicia sesión en el sistema
2. Sistema detecta rol CASHIER
3. Sidebar muestra: Dashboard, POS, Caja, Ventas, Productos
4. Cajero va a /cash
5. Si no hay caja abierta → Mostrar botón "Abrir Caja"
6. Cajero ingresa monto de apertura
7. Sistema crea CashSession ABIERTA
8. Cajero puede proceder al POS
```

### 7.2 Caso 2: Cajero cierra turno

```
1. Cajero va a /cash
2. Sistema muestra caja ABIERTA
3. Cajero hace clic en "Cerrar Caja"
4. Ingresa monto de cierre
5. Sistema calcula diferencia
6. Si hay diferencia → Cajero indica motivo
7. Sistema cierra caja y crea arqueo
8. Sesión queda ABIERTA en base de datos
9. Cajero hace logout → Sesión SIGUE ABIERTA
```

### 7.3 Caso 3: Cajero imprime reporte

```
1. Cajero va a /cash
2. Sección "Reporte del Día"
3. Click en "Imprimir Reporte"
4. Sistema genera HTML con todos los totales
5. Navegador abre diálogo de impresión
6. Reporte incluye:
   - Fecha
   - Total por método de pago
   - Suma total del día
```

### 7.4 Caso 4: Cajero busca cliente

```
1. Cajero está en POS
2. Click en "Buscar cliente"
3. Sistema muestra lista de clientes (solo lectura)
4. Cajero selecciona cliente
5. Venta se asocia al cliente
6. Desde /sales, Cajero puede ver sus boletas
7. Click en "Imprimir" → Reproduce boleta
```

---

## 8. Notas Técnicas

### 8.1 Sesión de Caja y Logout

**Comportamiento actual** (correcto):
- Al hacer logout, la sesión de caja NO se cierra
- La sesión queda ABIERTA en la base de datos
- Solo se cierra con acción manual o por administrador

**Justificación**:
- Permite múltiples cajeros en paralelo
- El administrador puede revisar caja de un cajero que se fue
- Mantiene historial de movimientos

### 8.2 Arqueo de Caja

**Tipos de arqueo**:
- PARCIAL: Durante el turno
- CIERRE: Al cerrar caja
- SUPERVISOR_AUDIT: Auditoría de supervisor

**Para CASHIER**:
- Puede hacer arqueo PARCIAL
- Puede hacer arqueo de CIERRE
- NO puede hacer SUPERVISOR_AUDIT

---

*Documento generado: 2026-04-21*
*Próximo paso: Implementación de cambios en frontend*