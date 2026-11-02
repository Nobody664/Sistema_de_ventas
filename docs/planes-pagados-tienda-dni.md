# Actualización de planes pagados: tienda y consultas DNI

## Plan breve

1. Unificar beneficios de pago y cuotas persistidas: Start 500, Medio 1500, Profesional 3000 consultas mensuales; administración exclusiva desde Super-Admin.
2. Migrar el catálogo existente sin cambiar precios, pagos, suscripciones ni consumos; aplicar la misma política a nuevas altas/ediciones y al seed.
3. Otorgar storefront y DNI cuando la empresa tenga suscripción activa/vigente y pago positivo confirmado. Conservar el control comercial de publicación, registro y checkout del administrador.
4. Corregir la configuración y el contrato del proveedor DNI, verificar nombre completo, cuota, aislamiento y flujo de tienda; probar y crear commits en español en una subrama.

## Correspondencia de planes

| Nombre solicitado | Código existente | Cuota inicial mensual |
| --- | --- | --- |
| Start | START (Startup) | 500 |
| Medio | GROWTH (Growth) | 1500 |
| Profesional | SCALE (Scale) | 3000 |

Las cuotas se guardan en `Plan.apiQuota`. Super-Admin puede modificarlas desde Planes. Los valores anteriores son iniciales, no un límite fijo impuesto por el frontend. Un plan de pago requiere cuota positiva.

## Alcance de pago y tienda

- Beneficios comerciales disponibles solo con suscripción ACTIVE, vigente, empresa ACTIVE, plan de precio positivo y al menos un Payment SUCCEEDED de importe positivo de esa suscripción.
- Un comprobante pendiente, un pedido pagado por un comprador final o una suscripción de prueba no sustituyen un pago confirmado del SaaS.
- La capacidad storefront permite al administrador habilitar su tienda. No publica productos ni activa compras automáticamente.
- Mantener separados: tienda habilitada, registro habilitado y checkout habilitado. El registro requiere correo operativo/verificación; la compra requiere perfil, pago y envío válidos.
- Catálogo, carrito, métodos/pago y envío siguen acotados a empresa y cuenta, sin ampliar privilegios del cliente final sobre el panel interno o el buscador DNI laboral.

## Aplicación a empresas existentes y futuras

La migración `20261114000000_paid_storefront_dni` actualiza módulos, flags y cuotas del catálogo de planes existente, preservando otros módulos y funciones. No reinicia contadores mensuales ni modifica precios o fechas.

El servicio de capacidades aplica la política a suscripciones existentes y nuevas. La caché utiliza un espacio de claves nuevo para no reutilizar valores de la política anterior. La edición de un plan invalida la caché de todas sus empresas; no requiere reasignar cada suscripción o volver a iniciar sesión.

Los consumos previos se conservan. Si superan la nueva cuota de un plan, nuevas consultas externas quedan bloqueadas hasta cambiar de cuota/periodo, sin falsificar el historial de consumo.

## Contabilización

Se conserva el periodo mensual UTC y el contador de API existente por empresa. DNI/RUC consumen un intento cuando se consulta al proveedor; una respuesta válida en caché no consume otro intento. Las integraciones que ya compartían el contador mantienen esa regla. Los rate limits por minuto son independientes.

## Diagnóstico y corrección de DNI

En Render existen variables de Decolecta (`RENIEC_API_URL`, token, query param, header/prefix y timeouts), pero no estaban declaradas en el esquema de entorno. Además, el servicio anterior agregaba el DNI como segmento de ruta y solo leía nombres en formato camelCase. Eso podía omitir la configuración y devolver nombres vacíos ante respuestas en formato `first_name` / `first_last_name` / `second_last_name`.

La corrección:

- Declara y conserva las variables `RENIEC_*` y `SUNAT_*` en el esquema de entorno.
- Construye la consulta según el contrato de Decolecta: `GET /v1/reniec/dni?numero=<dni>` con `Authorization: Bearer <token>`; RUC usa `/v1/sunat/ruc`.
- Acepta respuestas planas o envueltas en `data`/`result`, nombres en snake_case o camelCase y exige que el documento devuelto coincida con el consultado.
- Rechaza nombres vacíos y respuestas de otro documento; no guarda resultados inválidos en caché.
- Mantiene DNI/RUC como herramienta laboral aislada de la tienda y protegida por módulo, feature, empresa y cuota.
- Consume un intento externo antes de llamar al proveedor; una entrada de caché válida no consume. Diferencia 404, credenciales, límite del proveedor, timeout y errores de transporte.

No se consultaron documentos de personas reales: las pruebas usan fixtures.

## Verificación ejecutada

En la rama `mejora/planes-pagados-tienda-dni`:

- `npm run lint` en backend y frontend: sin errores.
- `npm test` en backend: 436 pruebas aprobadas.
- `npm test` en frontend: 96 pruebas aprobadas.
- `npm run test:browser:store`: registro, acceso comercial, perfil, catálogo, carrito, cotización, pedido, comprobante, atención administrativa y entrega; vista móvil sin desbordamiento.
- `npm run build` en backend y frontend: compilación correcta.
- `npx prisma validate`: esquema válido.
- Migración probada con PostgreSQL embebido: actualiza cuotas y módulos sin cambiar precios ni reiniciar el consumo existente.

## Despliegue

Los cambios quedan en `mejora/planes-pagados-tienda-dni`, con commits locales en español. Para que surtan efecto en producción se debe:

1. Configurar `RENIEC_API_URL`, `RENIEC_API_TOKEN`, `RENIEC_QUERY_PARAM=numero`, `RENIEC_AUTH_HEADER=Authorization`, `RENIEC_TOKEN_PREFIX=Bearer` y, si aplica, las variables `SUNAT_*` en el backend.
2. Aplicar la migración `20261114000000_paid_storefront_dni`.
3. Publicar backend y frontend.
4. Verificar que cada empresa con suscripción vigente y pago confirmado vea la tienda y pueda habilitarla; las empresas sin pago confirmado no deben obtener los beneficios.

No se modificaron planes, pagos, suscripciones ni consumos de producción durante las verificaciones de la rama. La habilitación efectiva de la tienda, el registro, el catálogo y el checkout sigue requiriendo la configuración comercial del administrador.
