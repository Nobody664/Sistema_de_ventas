# Módulo: Users

## Propósito
Servicio interno de acceso a usuarios. Concentra las operaciones de lectura (`findByEmail`,
`findById`) y la creación del usuario propietario de una empresa (`createOwner`, que crea
`User` + `Membership COMPANY_ADMIN`). No resuelve un caso de uso HTTP propio; es consumido
por otros módulos (principalmente `AuthService`).

## Archivos clave
- `backend/src/modules/users/users.service.ts` — único servicio del módulo; expone los métodos de acceso a `users`.
- `backend/src/modules/users/users.module.ts` — registra y exporta `UsersService`; importa `PrismaModule`. **No declara `controllers`.**

## Endpoints
Ninguno. El módulo **no tiene controller** y no registra rutas; `UsersService` solo se expone
como provider exportado a otros módulos (p. ej. `AuthModule`).

## Funciones del servicio (`UsersService`)

### `findByEmail(email: string)`
- **Qué hace**: Busca un usuario por `email` único.
- **Escribe en**: ninguna tabla (solo lectura).
- **Devuelve**: el registro `User` completo o `null` (`prisma.user.findUnique({ where: { email } })`).
- **Lanza**: ninguna excepción.

### `findById(id: string)`
- **Qué hace**: Busca un usuario por `id`.
- **Escribe en**: ninguna tabla (solo lectura).
- **Devuelve**: el registro `User` completo o `null` (`prisma.user.findUnique({ where: { id } })`).
- **Lanza**: ninguna excepción.

### `createOwner(input: { email; passwordHash; fullName; companyId })`
- **Qué hace**: Crea un `User` con `globalRole: 'USER'` y, anidado en la misma operación, crea una `Membership` para el `companyId` con `role: 'COMPANY_ADMIN'`.
- **Escribe en**: `users` y `memberships` (creación anidada en `prisma.user.create`).
- **Devuelve**: el `User` creado (sin incluir las relaciones por defecto).
- **Lanza**: errores de Prisma (p. ej. violación de unicidad `P2002` si `email` ya existe), que el filtro global mapea a HTTP. No lanza excepciones HTTP propias.

## Notas
- No hay DTOs ni validación propia en este módulo: la validación de entrada ocurre en los módulos que lo invocan (p. ej. `RegisterDto` en auth) y la creación del usuario asume un `passwordHash` ya calculado con argon2.
- No realiza auditoría, notificaciones ni caché.
- Otros módulos mencionados como consumidores: `auth.module.ts` importa `UsersModule` y usa `findByEmail` (register/login/forgot-password), `findById` (refresh/change-password/update-profile) y `createOwner` (register).
