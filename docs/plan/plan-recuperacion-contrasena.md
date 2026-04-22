# Plan: Sistema de Recuperación de Contraseña

## 1. Análisis
 
### 1.1 Requisitos Funcionales

| Requisito | Descripción |
|-----------|-------------|
| Solicitar código | Usuario ingresa email, recibe código de 6 dígitos |
| Código expirable | Código expira en 10 minutos |
| Validar código | Usuario ingresa código + nueva contraseña |
| UX moderna | Input con ojito para mostrar/ocultar contraseña |
| Seguridad | Rate limiting, solo 3 intentos por IP |

### 1.2 Flujo de Usuario

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PÁGINA         │     │  EMAIL          │     │  PÁGINA         │
│  SOLICITAR      │────▶│  ENVÍO          │────▶│  CAMBIAR        │
│  CÓDIGO         │     │  CÓDIGO         │     │  CONTRASEÑA     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │           ┌─────────────────┐                 │
        └──────────▶│  CÓDIGO         │◀────────────────┘
                    │  VÁLIDO         │
                    │  (10 min)       │
                    └─────────────────┘
```

### 1.3 Estructura de Datos

```typescript
// Tabla: PasswordReset (Prisma)
model PasswordReset {
  id          String   @id @default(cuid())
  email       String
  code        String   // Código de 6 dígitos (hash)
  expiresAt   DateTime // Expira en 10 minutos
  usedAt      DateTime? // Cuándo se usó
  createdAt   DateTime @default(now())
  ipAddress   String?

  @@index([email, createdAt])
}
```

### 1.4 Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/password-reset/request` | Solicitar código |
| POST | `/auth/password-reset/verify` | Validar código y cambiar contraseña |

---

## 2. Implementación

### 2.1 Backend

#### Archivos a modificar:
1. `backend/.env` - Agregar SMTP
2. `backend/prisma/schema.prisma` - Agregar modelo PasswordReset
3. `backend/src/modules/email/email.service.ts` - Implementar SMTP
4. `backend/src/modules/auth/dto/auth.dto.ts` - DTOs para recovery
5. `backend/src/modules/auth/auth.service.ts` - Lógica de recovery
6. `backend/src/modules/auth/auth.controller.ts` - Endpoints

#### Configuración SMTP:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=cm1803419@gmail.com
SMTP_PASSWORD=jfadnrnsmdhsgywo
SMTP_FROM_EMAIL=cm1803419@gmail.com
SMTP_FROM_NAME=LAB MAVROS BTC
SMTP_ENABLED=true
SMTP_USE_TLS=true
```

### 2.2 Frontend

#### Páginas a crear:
1. `frontend/app/forgot-password/page.tsx` - Solicitar código
2. `frontend/app/reset-password/page.tsx` - Cambiar contraseña (con token/email+code)

#### UX/UI:
- Input de contraseña con ojito (mostrar/ocultar)
- Diseño minimalista, oscuro (theme existente)
- Código de 6 dígitos con input individual por carácter
- Temporizador de 10 minutos visible
- Validación en tiempo real

---

## 3. Detalles Técnicos

### 3.1 Generación de Código

```typescript
// Código de 6 dígitos
const code = Math.floor(100000 + Math.random() * 900000).toString();

// Hash del código (no almacenar plano)
const hashedCode = await argon2.hash(code, { saltLength: 16 });
```

### 3.2 Email Template

```html
Subject: Código de recuperación de contraseña

Tu código de recuperación es: 123456

Este código expira en 10 minutos.

Si no solicitaste este cambio, ignora este correo.
```

### 3.3 Validación

- Código debe coincidir (verificar con argon2)
- No debe estar usado (usedAt = null)
- No debe estar expirado (expiresAt > now())
- Rate limit: 3 intentos por IP en 15 minutos

---

## 4. Seguridad

### 4.1 Medidas

| Medida | Implementación |
|--------|---------------|
| Hash de código | argon2 |
| Expiración | 10 minutos |
| Rate limiting | 3 intentos/IP/15min |
| Logging | Registrar IP y intentos |
| HTTPS | Obligatorio en producción |

---

## 5. Estado de Implementación

- [ ] Backend: Configuración SMTP
- [ ] Backend: Modelo PasswordReset
- [ ] Backend: EmailService con SMTP
- [ ] Backend: Endpoints de recovery
- [ ] Frontend: Página forgot-password
- [ ] Frontend: Página reset-password
- [ ] Frontend: Input con ojito
- [ ] Testing

---

*Documento generado: 2026-04-22*
