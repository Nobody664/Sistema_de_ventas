# Plan: Mejora de Sistema de Cambio de Plan

## Análisis del Sistema Actual

### Backend
- ✅ Existe modelo `PlanUpgradeRequest` en Prisma
- ✅ Existe servicio `PlanUpgradeRequestsService` con métodos:
  - `createRequest()` - Crear solicitud
  - `submitProof()` - Enviar comprobante
  - `getPending()` - Obtener solicitudes pendientes (para admins)
  - `getByCompany()` - Obtener solicitudes por empresa
  - `review()` - Revisar solicitud (aprobar/rechazar)

### Frontend
- ❌ No hay endpoint para obtener solicitud pendiente por empresa
- ❌ La página de "Mi Plan" siempre muestra todos los planes disponibles

## Lógica Requerida

### Reglas de Negocio
1. **Si hay solicitud pendiente**: Mostrar solo plan actual + mensaje de "esperando confirmación"
2. **Si hay solicitud aprobada**: Actualizar plan actual y mostrar planes siguientes
3. **Planes a mostrar**: Solo los planes de nivel superior al actual

### Orden de Planes
```
FREE → START → GROWTH → SCALE
```

- FREE: Muestra START, GROWTH, SCALE
- START: Muestra GROWTH, SCALE
- GROWTH: Muestra SCALE
- SCALE: No muestra opciones de upgrade

## Implementación

### 1. Backend: Endpoint para obtener solicitud pendiente
- Endpoint: `GET /subscriptions/upgrade-requests/pending`
- Retorna: solicitud pendiente o null

### 2. Frontend: Modificar SubscriptionPageClient
- Obtener solicitud pendiente al cargar
- Si hay solicitud pendiente:
  - Mostrar mensaje: "Esperando confirmación de cambio de plan de [actual] a [nuevo]"
  - Ocultar lista de planes
- Si no hay solicitud:
  - Mostrar solo planes de nivel superior

## Cambios a Realizar

1. **Backend**: Agregar endpoint `GET /subscriptions/upgrade-requests/pending`
2. **Frontend**: 
   - Modificar page.tsx para obtener solicitud pendiente
   - Modificar subscription-page-client.tsx para mostrar estado
