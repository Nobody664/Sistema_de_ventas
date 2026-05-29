```txt
Eres un Arquitecto Senior de Seguridad Backend especializado en PostgreSQL, Supabase, FastAPI, PostgREST, RBAC y Row Level Security (RLS).

Necesito que hagas un análisis profesional e integral de seguridad sobre mi sistema actual y soluciones correctamente un problema crítico detectado por lint/security scan:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEMA DETECTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Título:
RLS Disabled in Public: public.users

Esquema:
public

Descripción:
La tabla public.users está expuesta mediante PostgREST/Supabase API y NO tiene Row Level Security (RLS) habilitado.

Riesgo:
Los datos podrían quedar expuestos o manipulables dependiendo de los GRANTs actuales para roles como:
- anon
- authenticated
- PUBLIC

Necesito resolverlo de forma PROFESIONAL, SEGURA y ESCALABLE, evitando que este problema vuelva a ocurrir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJETIVO GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quiero una solución completa basada en:

✅ RLS
✅ RBAC real
✅ arquitectura segura
✅ permisos granulares
✅ ownership por usuario
✅ separación entre usuarios normales y SuperAdmin
✅ buenas prácticas enterprise
✅ compatible con Supabase/PostgREST/FastAPI
✅ preparada para producción

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUISITOS IMPORTANTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANTES de generar cualquier SQL o código:

1. Analiza el esquema actual.
2. Detecta automáticamente:
   - si el sistema usa UUID o integer IDs
   - cuál es la columna owner correcta
   - si public.users.id coincide con auth.users.id
   - si ya existe RBAC
   - si ya existen roles/permisos/tablas relacionadas
   - si existen claims JWT
   - si ya hay políticas RLS
   - si existen GRANTs inseguros

3. NO asumas estructuras.
4. Primero inspecciona el sistema y luego construye la solución.
5. La solución debe ser segura incluso si el frontend es comprometido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODELO DE SEGURIDAD DESEADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USUARIOS NORMALES:
- solo pueden CRUD de SU propia fila
- nunca pueden leer/modificar/eliminar filas ajenas
- acceso únicamente autenticado

SUPERADMIN:
- acceso total global
- puede CRUD cualquier fila
- bypass administrativo controlado

ANON:
- sin acceso a public.users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARQUITECTURA QUE QUIERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Necesito que diseñes una solución profesional incluyendo:

1. RLS correctamente implementado
2. RBAC real
3. separación clara:
   - auth
   - users
   - roles
   - permissions
4. políticas seguras
5. GRANTs mínimos
6. hardening de PostgREST/Supabase
7. prevención de escalación de privilegios
8. prevención de acceso horizontal
9. prevención de bypass desde API/frontend
10. recomendaciones de arquitectura futura

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSPECCIÓN OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primero genera consultas SQL para inspeccionar:

# Columnas
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
and table_name = 'users'
order by ordinal_position;

# Policies
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
and tablename = 'users';

# Grants
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
and table_name = 'users';

# Relaciones FK
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
AND tc.table_name='users';

# Verificar si users.id coincide con auth.users.id
# Detectar UUID/int
# Detectar claims JWT
# Detectar tablas RBAC existentes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LUEGO DEL ANÁLISIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quiero que generes:

━━━━━━━━━━━━━━━━━━
FASE 1 — HARDENING
━━━━━━━━━━━━━━━━━━

- Enable RLS
- Revocar GRANTs inseguros
- Restringir anon
- Configuración segura

━━━━━━━━━━━━━━━━━━
FASE 2 — RBAC
━━━━━━━━━━━━━━━━━━

Diseña un RBAC profesional incluyendo:
- roles
- permissions
- role_permissions
- user_roles

Compatible con:
- FastAPI
- JWT
- Supabase Auth

━━━━━━━━━━━━━━━━━━
FASE 3 — SUPERADMIN
━━━━━━━━━━━━━━━━━━

Implementa una solución robusta para SuperAdmin.

Primero detecta:
- si ya existe role='superadmin'
- claims JWT
- tabla admins
- metadata auth.users

Si no existe:
- propón diseño seguro
- explica ventajas/desventajas

━━━━━━━━━━━━━━━━━━
FASE 4 — POLÍTICAS RLS
━━━━━━━━━━━━━━━━━━

Genera políticas completas y seguras para:

- SELECT
- INSERT
- UPDATE
- DELETE

Condiciones:
- usuario normal → solo own rows
- superadmin → acceso total

Debes usar:
- USING
- WITH CHECK
- TO authenticated

━━━━━━━━━━━━━━━━━━
FASE 5 — VALIDACIONES
━━━━━━━━━━━━━━━━━━

Genera pruebas SQL reales para validar:

✅ anon bloqueado
✅ usuario A no puede tocar usuario B
✅ superadmin sí puede
✅ RLS funcionando
✅ PostgREST seguro
✅ sin privilege escalation

━━━━━━━━━━━━━━━━━━
FASE 6 — ARQUITECTURA FUTURA
━━━━━━━━━━━━━━━━━━

Quiero recomendaciones profesionales sobre:

- mover tablas sensibles fuera de public
- usar schemas privados
- separar auth/users
- auditoría
- soft delete
- logs de seguridad
- triggers
- multi-tenant futuro
- performance de RLS
- índices recomendados
- naming conventions
- migraciones seguras

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quiero la respuesta organizada exactamente así:

1. Análisis del problema actual
2. Riesgos detectados
3. Inspección del esquema
4. Arquitectura recomendada
5. SQL paso a paso
6. Políticas RLS
7. RBAC
8. SuperAdmin
9. Validaciones
10. Recomendaciones enterprise
11. Checklist final

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NO simplifiques la solución.
- NO des ejemplos básicos.
- Actúa como arquitecto senior enterprise.
- Prioriza seguridad real de producción.
- Explica posibles vulnerabilidades.
- Detecta errores de diseño.
- Si encuentras problemas de arquitectura, propón refactor profesional.
- Piensa como auditor de seguridad + arquitecto backend senior.
```
