# Sistema de Roles y Permisos

## Roles del Sistema

### Global Roles (Nivel Sistema)
| Rol | Descripción |
|-----|-------------|
| SUPER_ADMIN | Acceso completo al sistema. Gestiona empresas, planes, auditoría. |
| SUPPORT_ADMIN | Acceso de soporte técnico. Sin acceso a datos de empresas. |
| USER | Usuario básico del sistema. |

### Company Roles (Nivel Empresa)
| Rol | Descripción |
|-----|-------------|
| COMPANY_ADMIN | Administrador de la empresa. Acceso total a recursos de su empresa. |
| MANAGER | Gerente de la empresa. Gestión de inventario, empleados, reportes. |
| CASHIER | Cajero. Registro de ventas, gestión de clientes, apertura/cierre de caja. |
| STAFF | Personal básico. Acceso limitado según necesidad. |

## Matriz de Permisos

### Productos
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Listar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Eliminar | ✅ | ✅ | ❌ | ❌ | ❌ |

### Clientes
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Listar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear | ✅ | ✅ | ✅ | ✅ | ❌ |
| Editar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Eliminar | ✅ | ✅ | ✅ | ❌ | ❌ |

### Empleados
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Listar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear | ✅ | ✅ | ✅ | ❌ | ❌ |
| Editar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Eliminar | ✅ | ✅ | ❌ | ❌ | ❌ |

### Ventas
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Listar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Crear | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver detalle | ✅ | ✅ | ✅ | ✅ | ❌ |
| Anular | ✅ | ✅ | ✅ | ❌ | ❌ |

### Inventario
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Ver movimientos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Registrar entrada | ✅ | ✅ | ✅ | ❌ | ❌ |
| Registrar salida | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ajuste | ✅ | ✅ | ❌ | ❌ | ❌ |

### Caja
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Abrir/Cerrar caja | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver reporte diario | ✅ | ✅ | ✅ | ✅ | ❌ |

### Dashboard y Reportes
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Dashboard general | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reportes de ventas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reportes financieros | ✅ | ✅ | ✅ | ❌ | ❌ |

### Gestión de Empresa (Solo COMPANY_ADMIN y SUPER_ADMIN)
| Acción | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | CASHIER | STAFF |
|--------|-------------|---------------|---------|---------|-------|
| Editar empresa | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gestionar planes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ver auditoría | ✅ | ❌ | ❌ | ❌ | ❌ |

## Notas
- Los permisos se implementan mediante el decorador `@Roles()` en los controladores
- El guard `RolesGuard` verifica los roles del usuario en cada solicitud
- El sistema soporta multi-tenant: cada empresa tiene sus propios datos aislados
