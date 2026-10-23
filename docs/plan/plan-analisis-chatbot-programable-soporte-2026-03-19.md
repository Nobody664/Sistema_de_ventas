# Plan + Analisis de Implementacion: Chatbot Integrado Programable (FAQ + Derivacion a Asesor)

Fecha: 2026-03-19
Proyecto: SISTEMA_DE_VENTAS
Stack: Next.js 16 App Router + NestJS + Prisma + PostgreSQL
Estado: Definicion funcional, tecnica y de seguridad lista para ejecucion

## 1) Objetivo funcional 8

Implementar un chatbot integrado en formato burbuja que permita:

- Responder preguntas frecuentes definidas/programadas por `SUPER_ADMIN`.
- Mostrar sugerencias de preguntas comunes para `COMPANY_ADMIN` y otros roles de empresa.
- Recibir preguntas libres y responder con fallback de derivacion a asesor.
- Escalar a chat humano/ticket cuando el bot no resuelve.

Ejemplos de FAQ iniciales:

- Como renovar plan o suscripcion.
- Como emitir boleta.
- Donde configurar primeros empleados.

## 2) Alcance por fases

## Fase 1 (MVP productivo)

- Burbuja global de chat en dashboard.
- Widget lateral de conversacion.
- Motor FAQ por palabras clave (reglas simples, deterministicas).
- Panel admin para CRUD de FAQ y mensajes fallback.
- Derivacion a asesor (mensaje automatico + crear ticket opcional).

## Fase 2 (operacion avanzada)

- Ranking de FAQ por efectividad.
- Auto-sugerencias por contexto de modulo (ventas, empleados, boletas).
- Derivacion configurable por horario/SLA.
- Versionado de respuestas FAQ.

## Fase 3 (optimizacion)

- Analytics completo de resolucion bot/humano.
- Segmentacion por tenant (personalizacion por empresa).
- A/B test de respuestas.

## 3) Roles y permisos

## Roles administrativos

- `SUPER_ADMIN`: control total del chatbot global, reglas, FAQ, fallback, politicas.
- `SUPPORT_ADMIN`: gestion operativa (editar FAQ publicadas, revisar metricas, escalamiento).

## Roles empresa

- `COMPANY_ADMIN`, `MANAGER`, `CASHIER`: uso del chatbot (consulta FAQ, pregunta libre, solicitar asesor).
- Restriccion: no pueden configurar respuestas globales ni reglas de auto-respuesta.

## Politica de permisos (recomendada)

- `support.bot:read` -> todos los roles autenticados.
- `support.bot:configure` -> `SUPER_ADMIN`, `SUPPORT_ADMIN`.
- `support.bot:publish_faq` -> `SUPER_ADMIN`, `SUPPORT_ADMIN`.
- `support.bot:derive_ticket` -> todos los roles autenticados.

## 4) Arquitectura objetivo

## Backend (NestJS)

Modulos reutilizados:

- `support-faq` (base de preguntas/respuestas).
- `support-automation` (reglas y triggers).
- `support-chat` (canal de conversacion y eventos).
- `support-tickets` (escalamiento humano).

Nuevo modulo recomendado:

- `support-bot` (orquestador de respuesta bot).

Responsabilidades de `support-bot`:

1. Recibir consulta del usuario.
2. Buscar FAQ candidatas por keywords + texto.
3. Responder con mejor coincidencia (o top sugerencias).
4. Si score bajo, enviar fallback de derivacion.
5. Crear ticket opcional cuando usuario lo confirma.

## Frontend (Next.js App Router)

Patron recomendado:

- Server Components para bootstrap y data inicial.
- Client Components para interaccion en tiempo real del widget.

Bloques UI:

- `chat-bubble` flotante global.
- `chat-widget-panel` (drawer fijo desktop + modal mobile).
- `faq-chip-list` (preguntas sugeridas clicables).
- `free-question-input`.
- `escalation-card` ("te derivamos con asesor").

## 5) Modelo de datos (Prisma) recomendado

Se apoya en entidades ya creadas y agrega metrica ligera:

### Reusar

- `SupportFaq`
- `SupportConversation`
- `SupportMessage`
- `SupportAutomationRule`
- `SupportTicket`

### Agregar (opcional recomendado)

`SupportBotInteraction`

- `id`
- `conversationId`
- `messageId`
- `matchedFaqId?`
- `confidenceScore` (0-100)
- `outcome` (`AUTO_ANSWERED`, `SUGGESTED`, `ESCALATED`)
- `createdAt`

Objetivo: medir precision y evolucion del bot.

## 6) API y contratos

## Endpoints nuevos sugeridos

- `POST /support/bot/ask`
  - input: `{ conversationId, question }`
  - output: `{ responseType, answer?, suggestions?, canEscalate }`

- `GET /support/bot/faqs/suggested`
  - input: contexto (rol/modulo opcional)
  - output: lista de FAQ sugeridas

- `POST /support/bot/escalate`
  - input: `{ conversationId, reason, createTicket }`
  - output: `{ escalated: true, ticketId? }`

- `PATCH /support/bot/settings`
  - solo admin soporte
  - configura mensaje fallback, umbral de confianza, auto-ticket, horarios

## Endpoints admin (CRUD dedicados)

- `GET/POST/PATCH/DELETE /support/faqs`
- `GET/POST/PATCH/DELETE /support/automation/rules`

## 7) Rutas App Router (paginas dedicadas)

## Uso (roles empresa y soporte)

- `app/(dashboard)/support/chat/page.tsx`
- `app/(dashboard)/support/chat/[id]/page.tsx`

## Configuracion bot (solo super/support)

- `app/(dashboard)/support/bot/page.tsx` (overview y estado)
- `app/(dashboard)/support/bot/faqs/page.tsx`
- `app/(dashboard)/support/bot/faqs/new/page.tsx`
- `app/(dashboard)/support/bot/faqs/[id]/edit/page.tsx`
- `app/(dashboard)/support/bot/rules/page.tsx`
- `app/(dashboard)/support/bot/rules/new/page.tsx`
- `app/(dashboard)/support/bot/rules/[id]/edit/page.tsx`
- `app/(dashboard)/support/bot/settings/page.tsx`

Nota: CRUD siempre en paginas dedicadas (sin modal como flujo principal).

## 8) Auth y seguridad

- Proteger backend con `JwtAuthGuard + RolesGuard`.
- Filtrar por tenant para cualquier query de empresa.
- Sanitizar contenido de pregunta/respuesta (evitar XSS).
- Rate limiting en `ask` para evitar abuso.
- Registrar auditoria en cambios de FAQ/reglas/config.

## 9) Reglas del motor bot (v1 simple, robusta)

Orden de decision:

1. Match exacto por pregunta canonical.
2. Match por keywords (peso por keyword critica).
3. Match parcial por similaridad simple (contains/token overlap).
4. Si score < umbral -> fallback de derivacion.

Respuesta fallback estandar:

"En estos momentos te estamos derivando con un asesor para ayudarte mejor. Si deseas, puedo crear un ticket ahora mismo."

## 10) UX/UI (direccion visual aplicada)

Concepto visual: "Operations Concierge"

- Estilo editorial-operativo, limpio pero con personalidad.
- Burbuja destacada con doble anillo y pulso suave cuando hay sugerencias nuevas.
- Panel con jerarquia tipografica clara y bloques de contexto.
- Chips FAQ con hover fuerte y feedback inmediato.
- Mensajes del bot diferenciados con color de sistema y iconografia constante.

Requisitos UX:

- Maximo 2 clics para llegar a respuesta FAQ sugerida.
- En mobile, panel ocupa 92-95vh con input fijo inferior.
- Accesibilidad: foco visible, labels, roles ARIA, contraste AA.

## 11) Configuracion y feature flags

Variables recomendadas:

- `SUPPORT_BOT_ENABLED=true`
- `SUPPORT_BOT_CONFIDENCE_THRESHOLD=65`
- `SUPPORT_BOT_AUTO_ESCALATE=false`
- `SUPPORT_BOT_MAX_SUGGESTIONS=5`
- `SUPPORT_BOT_RATE_LIMIT_PER_MINUTE=20`

Estrategia:

- Release gradual por feature flag.
- Activar primero para tenant interno/piloto.

## 12) Integracion con notificaciones y tickets

Eventos:

- Pregunta no resuelta -> opcion derivar.
- Derivacion aceptada -> crear ticket con resumen.
- Ticket creado -> notificar a soporte.

Payload minimo ticket desde bot:

- titulo: `Caso derivado por chatbot`
- descripcion: pregunta + transcript corto + metadata de contexto
- prioridad default: `MEDIUM` (configurable)
- source: `CHAT`

## 13) Pruebas y validacion

Orden de validacion:

1. Typecheck (`npm run lint`)
2. Unit tests servicios bot/rules
3. Integration tests permisos por rol
4. E2E flujo usuario:
   - abrir burbuja
   - seleccionar FAQ
   - hacer pregunta libre
   - fallback
   - derivar a ticket

Casos criticos:

- Usuario sin permisos admin intentando editar FAQ -> 403.
- Tenant A no ve FAQ privadas de tenant B.
- Pregunta libre sin match responde fallback sin 500.

## 14) Plan de ejecucion tecnica

## Sprint 1

- Crear `support-bot` service + endpoint `ask`.
- Integrar FAQ suggestion engine v1.
- Render burbuja + panel en frontend.

## Sprint 2

- Paginas dedicadas admin para FAQ/rules/settings.
- Integracion derivacion a ticket.
- Notificaciones y telemetria basica.

## Sprint 3

- Hardening permisos/tenant.
- QA e2e completo.
- Ajustes de UX y rendimiento.

## 15) Criterios de aceptacion final

- `SUPER_ADMIN` puede configurar FAQ y reglas desde paginas dedicadas.
- Roles empresa pueden usar chat-bot y preguntar libremente.
- Preguntas sin match derivan correctamente a asesor/ticket.
- Sin errores 500 en `/support/chat/*` ni `/support/tickets/*`.
- Flujo completo validado en desktop y mobile.

---

Este documento deja definido el plan integral de implementacion del chatbot programable con integracion real a soporte y tickets, incluyendo configuraciones, servicios, permisos, rutas y seguridad para pasar a desarrollo incremental sin romper datos existentes.
