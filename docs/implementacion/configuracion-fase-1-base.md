# Configuración — Fase 1: infraestructura existente

Rama activa: `refix/configuracion-fase-1-base`.

## Funciones conectadas

- El tema usa `next-themes`, comparte la preferencia con el control del encabezado y persiste en el navegador. No se guarda como un dato del negocio.
- Configuración presenta datos reales de empresa, zona horaria, moneda e idioma disponible. Las opciones futuras que antes eran botones o interruptores sin acción se retiran hasta implementar su funcionalidad.
- La región se lee y guarda mediante `GET/PATCH /companies/current`. Los errores de guardado permiten reintentar sin perder la selección pendiente.
- La moneda es informativa en esta fase. El endpoint del negocio rechaza una modificación de moneda para evitar reinterpretar importes históricos; no se alteran montos ni se ejecuta conversión.
- Español es el idioma disponible; no se ofrece un cambio sin traducciones.
- Mi perfil, datos de empresa, Mi plan, Mis pagos y la cancelación existente conservan acciones reales. La solicitud de cierre enlaza a soporte, en lugar de simular una eliminación de cuenta.

## Datos de empresa y estado de la sesión

- La edición distingue errores de consulta de estados de carga y dispone de reintento.
- El formulario conserva datos por empresa y deshabilita la edición mientras guarda. Los valores vacíos opcionales se envían como `null` y los textos se normalizan sin espacios sobrantes.
- El indicador de perfil completo usa TanStack Query y se invalida después de guardar datos legales/de contacto.
- Las consultas nuevas esperan a que se establezca el alcance de sesión. Así la limpieza de caché al identificar al usuario no cancela permanentemente una consulta recién iniciada.
- Si falla la comprobación cliente de la sesión, Configuración ofrece reintentar esa comprobación, en lugar de permanecer indefinidamente en un spinner o permitir escrituras con identidad sin confirmar.

## Zona horaria aplicada

- Se valida la zona IANA en el DTO y en el servicio de actualización del negocio.
- Un proveedor de configuración reutiliza el registro de empresa y centraliza el formato de fechas de registro en ventas, detalle de venta, productos, órdenes, suscripción y pagos.
- Los movimientos conservan su instante UTC en BD. Cambia la representación del instante y su agrupación por día, no el dato almacenado.
- El dashboard calcula el inicio/fin del día y del mes en la zona guardada. Sus claves de caché incluyen zona, día y versión de los datos de empresa.
- Los gráficos de métricas y los reportes usan días locales y rangos UTC equivalentes. Los filtros de fecha pura en reportes se interpretan como días de esa empresa; los filtros con instante explícito conservan ese instante.
- Los límites se calculan como días de calendario, incluyendo días de 23/25 horas y zonas donde se omite la medianoche por una transición.
- Las fechas puramente de calendario, como vencimientos de producto, no se convierten masivamente ni se reescribe el histórico. La configuración regional del negocio no altera los períodos financieros UTC de plataforma.
- El formateador normaliza espacios del período horario para evitar diferencias de texto SSR/hidratación entre Node y Chromium.

## Separación de perfiles

`SUPER_ADMIN` conserva el contexto de plataforma: tema y herramientas globales, sin consultas a una empresa o plan propios. Las opciones de región y edición de empresa se presentan a `COMPANY_ADMIN`. Los guards de rol, tenant y estado de empresa existentes siguen aplicándose en backend.

## Verificación

- Backend: lint, **336 pruebas aprobadas**, build correcto.
- Frontend: lint, **53 pruebas aprobadas**, build Webpack correcto.
- `npm run test:browser:settings`: cinco comprobaciones de tema, persistencia regional, datos/perfil completo, recuperación de sesión y separación de Super Admin.
- `npm run test:browser:refix`: 16 comprobaciones aprobadas.
- `npm run test:browser:purchases`: cinco comprobaciones aprobadas.
- Las pruebas de configuración usan datos sintéticos y navegador en UTC para comprobar que la zona de la empresa prevalece sobre la del navegador.
- El caso regional comprueba un error de guardado, su reintento, la persistencia tras recargar y el cambio de día mostrado para un mismo instante en Lima/México.

Se usan columnas existentes de `Company`. No se requieren migraciones nuevas en esta fase. El trabajo se guarda en un commit local de su subrama; su publicación requiere autorización de integración y despliegue posteriores.
