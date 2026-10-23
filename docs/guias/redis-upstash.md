# Guía para obtener Redis en Upstash

## ¿Qué es Upstash?

Upstash es un servicio de Redis en la nube con plan gratuito. Es ideal para caching y colas en producción.

---

## Paso 1: Crear cuenta en Upstash

1. Ve a: **https://upstash.com/**
2. Haz click en **"Get Started"** o **"Sign Up"**
3. Regístrate con tu cuenta de GitHub (más rápido)

---

## Paso 2: Crear una base de datos Redis

1. После de iniciar sesión, serás redirigido al dashboard
2. Haz click en **"+ Create Database"** o **"New Database"**

### Configuración recomendada:

| Campo | Valor |
|-------|-------|
| **Name** | ventas-saas-redis |
| **Type** | Redis |
| **Region** | Oregon (o la más cercana a tus usuarios) |
| **Plan** | Free (granuliito) |

3. Haz click en **"Create"**

---

## Paso 3: Obtener la URL de conexión

1. Una vez creada la database, serás redirigido a los detalles
2. Busca la sección **"Connection"** o **"Connect"**
3. Verás algo como:

```
redis://default:password123@redis.upstash.io:6379
```

4. Haz click en el botón **"Copy"** para copiar la URL

### Formato de la URL:

```
redis://[USERNAME]:[PASSWORD]@[HOST]:[PORT]
```

| Campo | Ejemplo |
|-------|--------|
| Username | `default` |
| Password | `password123` |
| Host | `redis.upstash.io` |
| Port | `6379` |

---

## Paso 4: Configurar en Render

### Opción A: Agregar como variable de entorno

1. Ve al dashboard de Render: https://dashboard.render.com/
2. Selecciona tu servicio **Sistema_de_ventas**
3. Ve a **Environment** → **Environment Variables**
4. Agrega:

| Variable | Valor |
|---------|------|
| `REDIS_URL` | `redis://default:TU_PASSWORD@TU_HOST.upstash.io:6379` |

5. Haz click en **Save Changes**

### Opción B: Eliminar REDIS_URL

Si no quieres usar Redis, simplemente **elimina** la variable `REDIS_URL` de Render. El sistema usará cache en memoria automáticamente.

---

## Paso 5: Verificar la conexión

Después de guardar, el deploy automáticamente intentará conectarse a Redis. Deberías ver en los logs:

```
[Bull] Conectado a Redis exitosamente.
```

O si no tienes Redis configurado:

```
[Bull] REDIS_URL no configurado. BullModule deshabilitado (sin colas).
```

---

## Notas importantes

### Para el archivo `.env` local:

```env
# Si tienes Upstash
REDIS_URL=redis://default:TU_PASSWORD@TU_HOST.upstash.io:6379

# Opcional - simplemente no pongas nada (el sistema usa memoria)
# REDIS_URL=
```

### Para producción en Render:

Si tienes el plan gratuito de Upstash con el endpoint de US East, usa:

```
REDIS_URL=redis://default:TU_PASSWORD@us-na-1.upstash.io:6379
```

(La región más cercana a Render Oregon es US East)

---

## Solución de problemas

### Error: "getaddrinfo ENOTFOUND host"

El problema es que tienes `HOST` literal en lugar de un hostname real.

**Verifica:**
- `REDIS_URL=redis://USER:PASSWORD@HOST:6379` ❌ (INCORRECTO)
- `REDIS_URL=redis://default:abc123@redis.upstash.io:6379` ✅ (CORRECTO)

### Error: "ECONNREFUSED"

- Verifica que el puerto sea `6379`
- Verifica que la URL sea correcta
- Intenta crear una nueva database en Upstash

---

## Recursos útiles

- Dashboard Upstash: https://dashboard.upstash.com/
- Documentación: https://docs.upstash.com/
- Precios (plan gratuito): https://upstash.com/pricing