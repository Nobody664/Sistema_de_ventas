# Informe de Cuentas y Credenciales - Seed Database

## Fecha: 10 de Marzo 2026

---

## Credenciales de Acceso

| Email | Password | Rol | Empresa |
|-------|----------|-----|---------|
| `superadmin@ventas-saas.local` | `Admin123!` | SUPER_ADMIN | SaaS (todas las empresas) |
| `subadmin@ventas-saas.local` | `Admin123!` | SUPPORT_ADMIN | SaaS |
| `admin@acme.local` | `Admin123!` | COMPANY_ADMIN | Acme Retail |
| `manager@acme.local` | `Admin123!` | MANAGER | Acme Retail |
| `cajero@acme.local` | `Admin123!` | CASHIER | Acme Retail |
| `staff@acme.local` | `Admin123!` | STAFF | Acme Retail |
| `admin@nova.local` | `Admin123!` | COMPANY_ADMIN | Nova Market |

---

## Planes Disponibles

| Código | Nombre | Precio Mensual | Precio Anual | Límite Usuarios | Límite Productos |
|--------|--------|----------------|--------------|-----------------|------------------|
| START | Start | S/19.00 | S/190.00 | 3 | 500 |
| GROWTH | Growth | S/59.00 | S/590.00 | 15 | 10,000 |
| SCALE | Scale | S/149.00 | S/1,490.00 | 999 | 999,999 |

---

## Empresas Creadas

### Acme Retail
- **Slug**: acme-retail
- **Email**: contacto@acme.local
- **Teléfono**: +51 900 111 111
- **Plan**: Growth
- **Estado**: ACTIVE

### Nova Market
- **Slug**: nova-market
- **Email**: contacto@nova.local
- **Teléfono**: +51 900 222 222
- **Plan**: Scale
- **Estado**: ACTIVE

---

## Datos de Prueba por Empresa

### Acme Retail

**Categorías:**
- Cafetería
- Accesorios
- Bebidas
- Comida

**Productos:**
| SKU | Nombre | Precio | Stock |
|-----|--------|--------|-------|
| ACM-CAFE-001 | Café Premium 1kg | S/48.00 | 120 |
| ACM-MSE-002 | Mouse inalámbrico | S/89.00 | 60 |
| ACM-TEK-003 | Teclado mecánico RGB | S/159.00 | 45 |
| ACM-AUD-004 | Auriculares Bluetooth | S/249.00 | 30 |
| ACM-BEB-005 | Jugo de naranja | S/12.00 | 200 |
| ACM-COM-006 | Sandwich mixto | S/18.00 | 80 |

**Clientes:**
- Lucía Paredes (lucia@cliente.local)
- Marco Salinas (marco@cliente.local)

**Empleados:**
- Admin Acme - COMPANY_ADMIN
- Manager Acme - MANAGER
- Cajero Acme - CASHIER
- Staff Acme - STAFF

**Ventas:**
- ACM-SALE-1001: S/161.66 (1 Café + 1 Mouse)

---

## Permisos por Rol

### SUPER_ADMIN (Plataforma)
- Acceso a todas las empresas
- Gestión de suscripciones
- Ver/crear/editar todas las empresas

### SUPPORT_ADMIN (Plataforma)
- Acceso de soporte a todas las empresas
- Sin permisos de escritura en empresas

### COMPANY_ADMIN (Empresa)
- Gestión completa de su empresa
- CRUD de empleados, productos, categorías, clientes
- Ver reportes y ventas

### MANAGER (Empresa)
- CRUD de productos y categorías
- CRUD de clientes
- Ver ventas

### CASHIER (Empresa)
- Crear ventas
- Ver productos y clientes

### STAFF (Empresa)
- Solo lectura de productos

---

## Cómo probar las operaciones CRUD

1. **Iniciar sesión** en `http://localhost:3000/sign-in`
2. **Seleccionar cuenta** según el rol a probar
3. **Navegar** a las diferentes secciones del menú
4. **Probar** crear, editar y eliminar registros

---

## Notas

- La contraseña es相同的 para todas las cuentas: `Admin123!`
- El seed puede ejecutarse múltiples veces (usa `upsert`)
- Para recrear la base de datos: `npx prisma db push`
- Para ejecutar seed: `node prisma/seed.js`
