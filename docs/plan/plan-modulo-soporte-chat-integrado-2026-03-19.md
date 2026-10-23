# Plan Maestro: Modulo de Soporte, Chat Integrado, FAQ, Notificaciones y Tickets

Fecha: 2026-03-19
Estado: Plan + analisis tecnico completo listo para ejecucion
Alcance: Backend (NestJS + Prisma + BullMQ) + Frontend (Next.js 16 App Router) + UX/UI operativa

## 1) Objetivo de negocio

Construir un sistema de soporte integral para la plataforma, orientado a:

- Atencion en tiempo real (chat interno y soporte).
- Resolucion asistida por FAQ y respuestas automaticas.
- Gestion formal de incidencias con tickets y SLA.
- Notificaciones omnicanal dentro de la plataforma (y opcion de correo).
- Operacion de soporte para `SUPER_ADMIN`, `SUPPORT_ADMIN` y roles de empresa relevantes.

Resultado esperado:

- Reducir tiempos de primera respuesta.
- Estandarizar el proceso de soporte.
- Mejorar trazabilidad de casos.
- Evitar perdida de solicitudes en canales informales.

## 2) Roles y permisos objetivo

### Roles plataforma

- `SUPER_ADMIN`: vision total, configuracion global, escalamiento, auditoria.
- `SUPPORT_ADMIN`: gestion operativa de tickets/chats, resolucion y seguimiento.

### Roles empresa

- `COMPANY_ADMIN`: crea tickets, conversa por chat, ve historial de su empresa.
- `MANAGER`: crea y gestiona tickets de su empresa.
- `CASHIER` (opcional configurable): puede abrir tickets y consultar estado.

### Reglas de acceso clave

- Un usuario empresa solo puede ver tickets/chats/notificaciones de su `tenant`.
- Soporte global puede ver todos los tenants, con filtros por empresa, prioridad y SLA.
- FAQ publica/privada:
  - FAQ global (plataforma): visible para todos.
  - FAQ por tenant (opcional): visible solo para empresa dueña.

## 3) Arquitectura objetivo (alto nivel)

## 3.1 Backend (NestJS)

Nuevos modulos:

- `support-chat` (conversaciones, mensajes, participantes, estados en vivo).
- `support-tickets` (ticketing, SLA, colas, asignacion, estados).
- `support-faq` (base de conocimiento, categorias, versionado simple).
- `support-automation` (motor de respuestas automaticas y triggers).
- `support-notifications` (integracion con notificaciones existentes + nuevos eventos).

Integraciones con modulos actuales:

- `notifications`: reusar para in-app y eventos de soporte.
- `email`: enviar alertas (nuevo ticket, respuesta, SLA por vencer, cierre).
- `audit`: registrar cambios de estado, reasignaciones, cierres, escalamiento.
- `auth/roles`: permisos finos para operaciones de soporte.

## 3.2 Frontend (Next.js App Router)

Aplicar patron Server-First + Client Components solo en experiencia interactiva (chat y formularios complejos).

Nuevas areas App Router:

- `app/(dashboard)/support/` (hub del modulo).
- `app/(dashboard)/support/chat/`.
- `app/(dashboard)/support/tickets/`.
- `app/(dashboard)/support/faqs/`.
- `app/(dashboard)/support/settings/`.

Regla obligatoria de este plan:

- Operaciones CRUD con paginas dedicadas (sin modal como flujo principal).
- Formularios en rutas dedicadas: `new`, `[id]/edit`, vistas de detalle `[id]`.

## 3.3 Tiempo real y asincronia

- Chat en tiempo real via WebSocket Gateway (NestJS) o fallback long-polling.
- Eventos de soporte en cola (BullMQ) para notificaciones y SLA jobs.
- Revalidacion discreta de datos con React Query (`invalidateQueries` + `router.refresh`).

## 4) Modelo de datos propuesto (Prisma)

## 4.1 Entidades principales

### SupportConversation

- `id`, `companyId?`, `channel` (`INTERNAL`, `SUPPORT`), `status` (`OPEN`, `PENDING`, `CLOSED`), `createdById`, `assignedToId?`, `createdAt`, `updatedAt`, `lastMessageAt`.

### SupportConversationParticipant

- `conversationId`, `userId`, `roleInConversation` (`REQUESTER`, `AGENT`, `OBSERVER`), `lastReadAt`.

### SupportMessage

- `id`, `conversationId`, `senderId`, `type` (`TEXT`, `SYSTEM`, `FAQ_SUGGESTION`, `AUTO_REPLY`), `content`, `meta Json?`, `createdAt`.

### SupportTicket

- `id`, `companyId`, `requesterId`, `assignedToId?`, `conversationId?`, `categoryId?`, `title`, `description`, `status` (`OPEN`, `IN_PROGRESS`, `PENDING_CUSTOMER`, `RESOLVED`, `CLOSED`), `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), `source` (`CHAT`, `FORM`, `EMAIL`, `SYSTEM`), `slaDueAt?`, `firstResponseAt?`, `resolvedAt?`, `closedAt?`, `createdAt`, `updatedAt`.

### SupportTicketComment

- `id`, `ticketId`, `authorId`, `isInternal`, `content`, `createdAt`.

### SupportTicketStatusHistory

- `id`, `ticketId`, `fromStatus?`, `toStatus`, `changedById`, `reason?`, `createdAt`.

### SupportCategory

- `id`, `scope` (`GLOBAL`, `TENANT`), `companyId?`, `name`, `slug`, `description?`, `isActive`, `createdAt`.

### SupportFaq

- `id`, `scope` (`GLOBAL`, `TENANT`), `companyId?`, `categoryId?`, `question`, `answer`, `keywords String[]`, `isPublished`, `viewCount`, `helpfulCount`, `notHelpfulCount`, `sortOrder`, `createdById`, `updatedById?`, `createdAt`, `updatedAt`.

### SupportAutomationRule

- `id`, `scope`, `companyId?`, `name`, `trigger` (`NEW_CHAT`, `NEW_TICKET`, `KEYWORD_MATCH`, `STATUS_CHANGED`, `SLA_WARNING`), `conditions Json`, `action` (`SEND_AUTO_REPLY`, `SUGGEST_FAQ`, `ASSIGN_QUEUE`, `ESCALATE`, `NOTIFY_ROLE`), `actionConfig Json`, `isActive`, `createdAt`, `updatedAt`.

### SupportSlaPolicy

- `id`, `scope`, `companyId?`, `name`, `priority`, `firstResponseMinutes`, `resolutionMinutes`, `businessHours Json?`, `isActive`, `createdAt`.

## 4.2 Indices recomendados

- Tickets: `(companyId, status, priority, createdAt desc)`.
- Tickets: `(assignedToId, status, updatedAt desc)`.
- Chat: `(companyId, status, lastMessageAt desc)`.
- Mensajes: `(conversationId, createdAt asc)`.
- FAQ: `(scope, companyId, isPublished, sortOrder)`.
- Full text (si aplica): `SupportFaq(question, answer, keywords)`.

## 5) API y contratos de servicio

## 5.1 Tickets

- `GET /support/tickets` (filtros por estado, prioridad, asignado, fecha).
- `GET /support/tickets/:id`.
- `POST /support/tickets`.
- `PATCH /support/tickets/:id` (edicion general).
- `PATCH /support/tickets/:id/status`.
- `PATCH /support/tickets/:id/assign`.
- `POST /support/tickets/:id/comments`.
- `POST /support/tickets/:id/close`.
- `POST /support/tickets/:id/reopen`.

## 5.2 Chat

- `GET /support/chat/conversations`.
- `POST /support/chat/conversations`.
- `GET /support/chat/conversations/:id/messages`.
- `POST /support/chat/conversations/:id/messages`.
- `PATCH /support/chat/conversations/:id/read`.
- Gateway WS:
  - `support:joinConversation`
  - `support:message`
  - `support:typing`
  - `support:presence`

## 5.3 FAQ

- `GET /support/faqs`.
- `GET /support/faqs/:id`.
- `POST /support/faqs`.
- `PATCH /support/faqs/:id`.
- `DELETE /support/faqs/:id`.
- `POST /support/faqs/:id/feedback` (`helpful` / `not_helpful`).
- `GET /support/faqs/search?q=`.

## 5.4 Automatizaciones

- `GET /support/automation/rules`.
- `POST /support/automation/rules`.
- `PATCH /support/automation/rules/:id`.
- `DELETE /support/automation/rules/:id`.

## 5.5 SLA y metricas

- `GET /support/sla/policies`.
- `POST /support/sla/policies`.
- `PATCH /support/sla/policies/:id`.
- `GET /support/metrics/overview`.

## 6) Flujos funcionales clave

## 6.1 Flujo Chat -> Ticket

1. Usuario inicia chat desde soporte.
2. Motor automatizacion analiza mensaje inicial.
3. Si hay match FAQ, se sugiere respuesta automatica.
4. Si no resuelve o usuario solicita ayuda, se crea ticket desde chat.
5. Ticket se asigna por reglas (cola, categoria, prioridad).
6. Soporte responde y sistema notifica al usuario.
7. Resolucion y cierre con trazabilidad completa.

## 6.2 Flujo Ticket directo

1. Usuario crea ticket en formulario dedicado.
2. Se calcula SLA segun prioridad.
3. Se envia notificacion a agentes de soporte.
4. Agente actualiza estado, comenta, solicita mas datos.
5. Cierre y encuesta de utilidad opcional.

## 6.3 Flujo FAQ + auto respuestas

1. Admin soporte crea FAQ y keywords.
2. Regla automatica usa keywords para sugerir FAQ en chat/ticket.
3. Se mide utilidad (helpful/not helpful).
4. FAQs con baja utilidad se revisan periodicamente.

## 7) Estructura App Router (paginas dedicadas)

Propuesta completa de rutas:

```text
app/(dashboard)/support/page.tsx                              -> Hub de soporte

app/(dashboard)/support/chat/page.tsx                         -> Lista de conversaciones
app/(dashboard)/support/chat/[id]/page.tsx                    -> Conversacion detalle
app/(dashboard)/support/chat/new/page.tsx                     -> Nueva conversacion

app/(dashboard)/support/tickets/page.tsx                      -> Listado tickets
app/(dashboard)/support/tickets/new/page.tsx                  -> Crear ticket
app/(dashboard)/support/tickets/[id]/page.tsx                 -> Ticket detalle
app/(dashboard)/support/tickets/[id]/edit/page.tsx            -> Editar ticket
app/(dashboard)/support/tickets/[id]/assign/page.tsx          -> Asignacion dedicada
app/(dashboard)/support/tickets/[id]/close/page.tsx           -> Cierre dedicado

app/(dashboard)/support/faqs/page.tsx                         -> Listado FAQ
app/(dashboard)/support/faqs/new/page.tsx                     -> Crear FAQ
app/(dashboard)/support/faqs/[id]/page.tsx                    -> FAQ detalle
app/(dashboard)/support/faqs/[id]/edit/page.tsx               -> Editar FAQ

app/(dashboard)/support/settings/page.tsx                     -> Configuracion general soporte
app/(dashboard)/support/settings/automation/page.tsx          -> Reglas automaticas
app/(dashboard)/support/settings/automation/new/page.tsx      -> Crear regla
app/(dashboard)/support/settings/automation/[id]/edit/page.tsx-> Editar regla
app/(dashboard)/support/settings/sla/page.tsx                 -> Politicas SLA
app/(dashboard)/support/settings/sla/new/page.tsx             -> Crear politica SLA
app/(dashboard)/support/settings/sla/[id]/edit/page.tsx       -> Editar politica SLA
```

## 8) UX/UI objetivo (front-design aplicado)

## 8.1 Principios UX

- Priorizar velocidad de atencion (acciones clave visibles).
- Reducir ruido visual en panel operativo.
- Mantener contexto: ticket + chat + historial en una sola experiencia de detalle.
- Estados claros: `abierto`, `en progreso`, `esperando cliente`, `resuelto`, `cerrado`.

## 8.2 Diseño de la experiencia de chat

- Layout 3 columnas en desktop:
  - Filtros + colas
  - Lista de conversaciones
  - Panel activo de chat
- Mobile:
  - Lista y detalle en navegacion por pasos (stack).
- Elementos clave:
  - Indicadores de no leidos.
  - Estado de agente (online/ocupado/ausente).
  - Sugerencias de FAQ como chips accionables.
  - Boton "Convertir a ticket" fijo en cabecera de conversacion.

## 8.3 Diseño de tickets

- Tabla avanzada + vista kanban opcional.
- Filtros persistentes por URL params.
- Ficha detalle con:
  - timeline de estados,
  - comentarios internos/publicos,
  - SLA restante,
  - acciones rapidas (asignar, cambiar prioridad, cerrar).

## 8.4 Diseño de FAQ y automatizacion

- FAQ con editor rico basico (markdown/textarea mejorada).
- Buscador con resaltado de coincidencias.
- Reglas automaticas en constructor simple:
  - Trigger,
  - Condiciones,
  - Accion.

## 9) Servicio de notificaciones (integrado)

Eventos que deben notificar:

- Nuevo ticket creado.
- Ticket asignado/reasignado.
- Nuevo mensaje en chat de soporte.
- SLA por vencer / SLA vencido.
- Ticket resuelto/cerrado/reabierto.

Canales:

- In-app (obligatorio).
- Email (configurable por tipo de evento).

Preferencias por usuario:

- Tabla/config de opt-in por evento/canal.
- Silenciar notificaciones fuera de horario (si aplica).

## 10) Automatizaciones y respuestas automaticas

Motor inicial basado en reglas (sin LLM obligatorio en fase 1):

- Match por keyword / categoria.
- Respuesta predefinida.
- Sugerencia de articulo FAQ.
- Asignacion automatica por cola.
- Escalamiento por prioridad o tiempo.

Fase 2 opcional:

- Asistente IA para sugerir respuesta al agente (human-in-the-loop).

## 11) Observabilidad y calidad

Metricas operativas:

- First Response Time (FRT).
- Resolution Time (TTR).
- Tickets abiertos por prioridad.
- Tasa de resolucion por FAQ/auto-respuesta.
- Reaperturas.

Calidad tecnica:

- Logs estructurados por `ticketId`/`conversationId`.
- Auditoria de cambios criticos.
- Alertas de errores en jobs de SLA y notificaciones.

## 12) Seguridad y cumplimiento

- Tenant isolation obligatorio en todas las consultas.
- Validacion de permisos por endpoint.
- Sanitizacion de contenido en mensajes y FAQ (XSS).
- Rate limiting en chat y creacion de tickets.
- Retencion configurable de mensajes y adjuntos.

## 13) Plan de implementacion por fases

## Fase 0 - Preparacion (1-2 dias)

- Definir enums, roles y permisos.
- Diseñar migraciones Prisma.
- Definir contratos DTO/response estandar.

## Fase 1 - Tickets core (4-6 dias)

- CRUD tickets + historial de estado + comentarios.
- Vistas dedicadas de listado, crear, detalle, editar, cerrar.
- Integracion notificaciones basicas.

Entregable:

- Ticketing funcional extremo a extremo.

## Fase 2 - Chat integrado (5-7 dias)

- Conversaciones, mensajes, participantes.
- WS gateway y presencia basica.
- Crear ticket desde conversacion.

Entregable:

- Chat operativo con integracion a ticket.

## Fase 3 - FAQ + auto respuestas (4-6 dias)

- CRUD FAQ dedicado + categorias.
- Busqueda y sugerencias.
- Motor de reglas version 1.

Entregable:

- FAQ utilizable + respuesta automatica por reglas.

## Fase 4 - SLA + notificaciones avanzadas (3-5 dias)

- Politicas SLA.
- Jobs BullMQ de vencimientos.
- Panel metricas soporte.

Entregable:

- Operacion con control de tiempos y alertas.

## Fase 5 - Endurecimiento y rollout (3-4 dias)

- QA funcional + e2e criticos.
- Hardening seguridad.
- Ajustes UX final.
- Documentacion operativa.

## 14) Pruebas recomendadas

Backend:

- Unit tests: servicios de tickets/chat/faq/automation.
- Integration tests: permisos multi-tenant y transiciones de estado.
- e2e API: flujos principales y errores comunes.

Frontend:

- Component tests: formularios dedicados y validaciones.
- e2e (Playwright):
  - crear ticket,
  - responder chat,
  - convertir chat a ticket,
  - cerrar ticket,
  - recibir notificacion.

## 15) Backlog inicial de historias (resumen)

- Como `COMPANY_ADMIN`, quiero crear tickets con prioridad para pedir soporte.
- Como `SUPPORT_ADMIN`, quiero ver cola unificada de tickets por SLA.
- Como agente, quiero responder chats y convertir a ticket sin perder contexto.
- Como `SUPER_ADMIN`, quiero configurar reglas automaticas y SLA globales.
- Como usuario, quiero recibir notificaciones al actualizarse mi caso.
- Como admin de soporte, quiero medir tiempos y productividad.

## 16) Criterios de aceptacion globales

- Todas las operaciones CRUD en paginas dedicadas.
- Ticket y chat completamente aislados por tenant.
- Notificaciones in-app funcionando en todos los eventos criticos.
- FAQ + respuestas automaticas activas y configurables.
- Dashboard de soporte con KPIs minimos (FRT, TTR, abiertos por prioridad).
- Lint y typecheck sin errores en frontend y backend.

## 17) Riesgos y mitigaciones

- Riesgo: sobrecarga en tiempo real del chat.
  - Mitigacion: particionar por sala y limitar eventos de typing/presence.
- Riesgo: reglas automaticas generen ruido.
  - Mitigacion: feature flags + scoring de utilidad + apagado por regla.
- Riesgo: fuga de datos cross-tenant.
  - Mitigacion: guardas + filtros obligatorios en servicio + tests de aislamiento.

## 18) Decisiones de implementacion recomendadas para este proyecto

- Mantener Next.js App Router con Server Components para paginas de datos y Client Components solo para chat/forms.
- Reusar `React Query` existente para refresh discreto (`invalidateQueries` + `router.refresh`).
- Mantener consistencia visual actual del sistema, elevando UX de soporte con layout operativo y estados claros.
- Priorizar Fase 1 y 2 para valor rapido (tickets + chat).

---

Este documento deja el modulo completo especificado para desarrollo. La siguiente accion recomendada es iniciar la Fase 0 con migraciones Prisma y esqueleto de modulos NestJS, luego ejecutar Fase 1 con tickets dedicados end-to-end.
