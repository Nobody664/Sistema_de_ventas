# Configuración — Fase 2: preferencias de alertas

Rama: `refix/configuracion-fase-2-notificaciones`, encadenada a la Fase 1 (`6b67ef6`).

- Se guardan tres preferencias en la membresía usuario/empresa: ventas, stock/vencimientos y sonido. La migración `20261105000000_membership_notification_preferences` conserva el comportamiento previo mediante valores predeterminados `true`.
- `GET/PATCH /notifications/preferences` usa la identidad autenticada y la membresía activa. No admite identificar otra empresa o usuario en el payload. Los administradores globales no tienen preferencias de negocio propias.
- Las nuevas alertas operativas desactivadas no se insertan ni se publican por SSE. El historial existente permanece. Los avisos críticos de cuenta y pagos no se filtran por estos controles.
- El sonido depende de la preferencia cargada para la sesión actual y se reinicia al cambiar/cerrar la cuenta. El estado desconocido permanece sin sonido hasta cargar la preferencia.
- Las ventas POS/online y de distribuidor generan un efecto durable de venta para notificar a administradores/gerentes. La venta de distribuidor no dispara alertas de stock central.
- Configuración carga, guarda y confirma las preferencias; la campana usa los mismos datos de caché.

Verificación: lint y build en ambos proyectos, 36 pruebas backend dirigidas de notificaciones/distribuidor/outbox, 53 pruebas frontend y seis comprobaciones funcionales de Configuración en Chromium.

La migración está escrita y el cliente Prisma regenerado localmente. No se aplicó a BD compartida ni se publicó esta fase.
