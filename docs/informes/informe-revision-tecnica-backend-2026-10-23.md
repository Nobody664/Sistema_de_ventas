# Informe de revisión técnica y seguridad — Backend
 
**Fecha:** 2026-10-23

**Rama y revisión:** `main`, `625b5d3d5cd9e338e3cd1084c19e758737b6eb10`.

**Tecnologías:** NestJS, Prisma 7, PostgreSQL, Redis/BullMQ.

**Informe complementario:** [Frontend](informe-revision-tecnica-frontend-2026-10-23.md).

## 1. Dictamen ejecutivo

El backend tiene una base de protección real: autenticación global, roles, aislamiento por empresa en muchas consultas, DTOs, consultas parametrizadas con Prisma y validación binaria de imágenes. Sin embargo, **no debe considerarse que todas las acciones están correctamente autorizadas ni que todos los procesos financieros son consistentes**.

Las prioridades son:

1. Impedir que un administrador de empresa confirme por sí mismo el pago de su suscripción y reactive su cuenta.
2. Corregir el tratamiento del webhook de MercadoPago: una firma aceptada no queda vinculada a los datos del cuerpo que se utilizan para activar el plan.
3. Separar la administración de FAQs globales de la administración de contenido de una empresa.
4. Hacer efectivas la desactivación de usuarios, la revocación de membresías y los cambios de rol.
5. Unificar los controles de visibilidad de ventas en todos los endpoints que pueden devolverlas.
6. Corregir importes negativos, precios por presentación y transacciones incompletas de compras/inventario.
7. Revisar las alertas de dependencias y actualizar con pruebas de compatibilidad.

**No se encontró una ruta de SQL injection por concatenación de consultas en `backend/src`.** Esto no equivale a ausencia de vulnerabilidades: los problemas más graves encontrados son de autorización de negocio, confidencialidad y consistencia de estados.

## 2. Método, alcance y grado de certeza

Se revisaron configuración HTTP, guards, autenticación, DTOs, modelos/relaciones y los flujos de ventas, inventario, distribuidores, proveedores, pagos, suscripciones, soporte, notificaciones y plataforma. También se inspeccionaron los puntos de consulta/exportación y se ejecutó auditoría de dependencias.

La revisión combina:

- **Código:** evidencia directa en rutas, servicios, DTOs y configuración.
- **Demostración local:** ejecución de servicios reales con repositorios y efectos externos simulados. No se modificaron registros de producción para demostrar los fallos.
- **Dependencia:** aviso de `npm audit`; requiere determinar si sus condiciones de explotación se alcanzan en este despliegue.
- **Pendiente E2E:** validación con HTTP y sesiones reales de dos empresas, concurrencia y proveedores externos.

No se realizó una prueba de carga, explotación contra Render/Supabase, extracción de datos reales ni auditoría del sistema operativo, WAF o configuración interna de los proveedores. Las referencias corresponden al commit indicado, no a cambios posteriores.

### Criterio de severidad

| Nivel         | Criterio                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Crítica       | Alteración del cobro/activación de suscripciones o alerta crítica de dependencia, indicando por separado sus prerrequisitos. |
| Alta          | Autorización incorrecta, exposición relevante o pérdida de integridad financiera/inventario.                                 |
| Media         | Proceso incompleto, respuesta engañosa, validación insuficiente o riesgo de disponibilidad acotado.                          |
| Baja / mejora | Endurecimiento y mantenibilidad sin explotación demostrada.                                                                  |

## 3. Controles que sí funcionan

| Control                           | Evidencia y evaluación                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Autenticación por defecto         | `src/app.module.ts:155-174`: `JwtAuthGuard` y `RolesGuard` globales; `@Public()` marca excepciones. La ausencia de un guard local no implica por sí sola acceso anónimo.                               |
| Verificación criptográfica de JWT | `src/modules/auth/jwt.strategy.ts:25-42`: Passport valida firma y expiración. El problema B-04 es la vigencia de permisos, no aceptar JWT arbitrarios.                                                 |
| Permisos de plataforma            | `src/modules/platform/platform-finance.controller.ts:34-47`: finanzas exige SUPER_ADMIN y permisos específicos.                                                                                        |
| Tenant en operaciones habituales  | Ventas POS, productos, clientes, entradas, sucursales y varios recursos buscan por `companyId` obtenido de la sesión. Se encontraron excepciones de alcance que se detallan abajo.                     |
| DTOs y propiedades adicionales    | `src/main.ts:53-59`: `whitelist`, `forbidNonWhitelisted`, `transform`. Funciona cuando el parámetro es una clase DTO concreta. No valida automáticamente interfaces TypeScript.                        |
| Límite del cuerpo                 | `src/main.ts:46-47`: 2 MB para JSON y URL-encoded.                                                                                                                                                     |
| Imágenes                          | `src/common/helpers/image.helper.ts:128-194`: no se confía solo en nombre o MIME; se valida estructura, se decodifica y se reconstruye la imagen.                                                      |
| Contraseñas y refresh tokens      | Argon2 para contraseñas; refresh opacos almacenados como hash y con detección de reutilización secuencial. Hay un problema de concurrencia descrito en B-05.                                           |
| Errores de producción             | `src/common/filters/all-exceptions.filter.ts:139-146`: errores inesperados tienen mensaje genérico en producción; los errores Prisma habituales se traducen a HTTP.                                    |
| Antiduplicado contable de APIs    | `src/modules/platform/platform-api-usage.service.ts:296-344`: creación del egreso y reclamación de registros no contabilizados dentro de una transacción; si la reclamación falla, se lanza conflicto. |

### Validación de imágenes: respuesta al caso solicitado

La protección actual **rechaza**:

- URLs como `https://example.invalid/foto.jpg`, aunque terminen en una extensión permitida.
- `javascript:`, SVG, GIF, BMP, ICO, HTML y contenido ejecutable en los casos cubiertos por las pruebas.
- Base64 no canónico, firmas falsas, contenido truncado, MIME diferente del formato real y datos concatenados después de la imagen.
- PNG/WebP animados, dimensiones superiores a 8192 por lado, más de 12 millones de píxeles y exceso del tamaño permitido.

Además, reconstruye desde píxeles con Sharp, eliminando metadatos originales, y limita el tiempo del procesamiento. Existen límites específicos más pequeños para QR. Un texto o una “instrucción” dibujada dentro de una fotografía no se interpreta como código por este flujo. No se encontró un motor de IA que ejecute instrucciones extraídas de las imágenes.

Las pruebas de ingestión cubren productos, ajustes de pago, comprobantes, checkout y cambio de plan. El logo de plantilla utiliza `parseImageSource`. Esta protección del backend **no sustituye actualizar el optimizador de imágenes de Next.js**, que es otra superficie.

## 4. Hallazgos priorizados

| ID   | Severidad                            | Hallazgo                                                                                                         | Evidencia                                                |
| ---- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| B-01 | Crítica                              | Una empresa puede confirmar su propio pago de suscripción.                                                       | Código + demostración local.                             |
| B-02 | Crítica condicionada                 | El webhook utiliza datos de un cuerpo no ligado a la firma comprobada.                                           | Código + demostración local con firma sintética válida.  |
| B-03 | Alta                                 | COMPANY_ADMIN/MANAGER pueden administrar FAQs globales; feedback no aplica aislamiento.                          | Código + demostración de modificación global.            |
| B-04 | Alta                                 | Desactivación de usuarios y revocación/cambio de permisos no tienen efecto suficiente.                           | Código + login local de usuario inactivo.                |
| B-05 | Alta                                 | Rotación de refresh tokens y consumo de reset tokens sin reclamación atómica.                                    | Código; carrera pendiente de prueba concurrente.         |
| B-06 | Alta                                 | El filtro de ventas propias se puede eludir por otras rutas de lectura.                                          | Código.                                                  |
| B-07 | Alta                                 | Se aceptan impuestos/descuentos que producen ventas negativas y hay diferencias de precio por presentación.      | Código + venta local con total negativo.                 |
| B-08 | Alta                                 | Recepción de proveedor puede quedar parcialmente aplicada o duplicar stock.                                      | Código.                                                  |
| B-09 | Alta                                 | Algunas salidas de inventario y saldos de distribuidor no protegen la condición de saldo dentro de la escritura. | Código; concurrencia pendiente de prueba de integración. |
| B-10 | Alta                                 | Reversiones/notas de crédito no completan consistentemente el ciclo físico y contable.                           | Código.                                                  |
| B-11 | Alta                                 | Ciclo anual de upgrade se cobra sin conservar necesariamente el ciclo solicitado.                                | Código.                                                  |
| B-12 | Media                                | Promoción/revocación de administradores devuelve el modelo User con hash de contraseña.                          | Código.                                                  |
| B-13 | Media                                | Lectura de notificaciones de empresa ignora destinatario y permisos funcionales.                                 | Código.                                                  |
| B-14 | Media                                | Valores `null`, fechas y DTOs incompletos generan errores o semánticas incorrectas de PATCH.                     | Código + `null` aceptado que falla en Decimal.           |
| B-15 | Media                                | Registro de cuenta no es atómico y puede dejar empresas huérfanas.                                               | Código.                                                  |
| B-16 | Media                                | Operaciones completadas pueden responder error por fallos posteriores de correo/notificación.                    | Código.                                                  |
| B-17 | Media                                | Totales, filtros, monedas y paginación de informes no son consistentes.                                          | Código.                                                  |
| B-18 | Media                                | CSV permite interpretar valores de usuario como fórmulas.                                                        | Código + demostración local.                             |
| B-19 | Media                                | Consultas sin límites completos y cuota de API con carrera.                                                      | Código.                                                  |
| B-20 | Media                                | Readiness y streaming no reflejan adecuadamente degradación/caducidad.                                           | Código.                                                  |
| B-21 | Media                                | El filtro de excepciones elimina metadatos necesarios del error funcional.                                       | Código + demostración local.                             |
| B-22 | Crítica en auditoría de dependencias | Dependencias con avisos públicos; explotación concreta no demostrada.                                            | `npm audit --omit=dev --json`.                           |
| B-23 | Alta                                 | El cambio de plan genera CUID pero la subida/revisión exige UUID.                                                | Modelo/rutas + rechazo demostrado con el pipe real.      |
| B-24 | Alta                                 | El alta de plantillas omite un campo obligatorio y no guarda el default solicitado.                              | Esquema/código + inspección del payload real con mock.   |

### B-01. Autoconfirmación del pago de suscripción

**Referencias:** `src/modules/payments/payments.controller.ts:86-99`; `src/modules/payments/payments.service.ts:205-261`.

`PATCH /api/payments/:id/mark-paid` permite COMPANY_ADMIN y MANAGER. El servicio solo verifica que el pago de su empresa esté pendiente, lo cambia a `SUCCEEDED` y activa suscripción y empresa. No exige revisión de plataforma, verificación del proveedor ni comprobante aprobado.

**Impacto:** un usuario de la empresa que tenga un pago pendiente puede eludir el control de cobro, al menos mientras `TenantGuard` le permita acceder. Que la UI no muestre el botón no impide llamar a la API.

**Demostración:** con un pago sintético pendiente, el servicio ejecutó las actualizaciones `subscription-active` y `company-active` sin un actor de plataforma.

**Corrección:** reservar la confirmación a SUPER_ADMIN/proveedor verificado. La empresa debe poder enviar evidencia, no declarar el cobro recibido. Mover pago, suscripción, empresa e idempotencia a una sola transacción con actualización condicional del estado.

### B-02. Webhook: firma no vinculada al estado, importe y referencia utilizados

**Referencias:** `src/modules/payments/payments.service.ts:461-558,560-673`.

La firma se calcula con `data.id` de la query y el timestamp. Después se confía en `payload.status`, `payload.external_reference` y `payload.id`, sin consultar el pago a MercadoPago ni comprobar que el identificador del cuerpo corresponda al firmado. Tampoco se contrasta importe/moneda con una solicitud interna.

**Demostración:** la misma firma sintética válida y la misma query fueron aceptadas con dos cuerpos que apuntaban a empresas/planes distintos. La prueba sustituyó únicamente el efecto final de activación y no contactó al proveedor.

**Prerrequisito y certeza:** no se demostró obtener una firma real ni una activación anónima en producción. El defecto demostrado es que una firma aceptada no autentica los datos de negocio utilizados. Además, la construcción del manifiesto debe contrastarse con la especificación oficial vigente del proveedor; un HMAC interno correcto no prueba interoperabilidad.

**Corrección:** usar la notificación como aviso, recuperar el pago por ID con credenciales del servidor, comprobar estado, beneficiario, moneda, importe y referencia interna. Registrar el ID del evento/pago con unicidad y actualizar el dominio de forma atómica. La rama de actualización de `activateSubscription` tampoco renueva actualmente `startDate/endDate`, a diferencia de la de creación.

### B-03. Alcance incorrecto en FAQs

**Referencias:** `src/common/constants/permissions.constant.ts` (permisos de COMPANY_ADMIN/MANAGER); `src/modules/support/support-faq.controller.ts:62-87`; `src/modules/support/support-faq.service.ts:88-164`.

- Los roles de empresa tienen `SUPPORT_FAQ_MANAGE`.
- `create` utiliza GLOBAL por defecto y acepta `dto.companyId` sin ligarlo al actor no-plataforma.
- `assertAccess` autoriza automáticamente cualquier FAQ GLOBAL, incluso antes de modificarla o eliminarla.
- `submitFeedback` no recibe actor ni comprueba empresa/publicación y devuelve la FAQ completa; permite modificar contadores y obtener contenido de otra empresa si se conoce el ID.
- `findById` no exige `isPublished` al lector ordinario.

**Demostración:** un actor no-plataforma pudo modificar una FAQ GLOBAL con el servicio real y un repositorio simulado.

**Corrección:** separar autorización de lectura y escritura; solo plataforma modifica GLOBAL. Para TENANT, imponer `companyId` de la sesión. Pasar el actor al feedback y devolver solo contadores/resultado de la operación.

### B-04. Desactivación y permisos no sincronizados

**Referencias:** `src/modules/auth/auth.service.ts:147-202,239-284`; `src/modules/auth/jwt.strategy.ts:45-67`; `src/modules/employees/employees.service.ts:139-206,209-233,235-277`.

`login` y `refresh` no rechazan `user.isActive === false`. La estrategia JWT valida empresa pero no existencia/actividad del usuario ni vigencia de la membresía. Los roles del access token continúan válidos hasta su expiración. En `refresh`, si desaparece la membresía se conserva como fallback el antiguo `stored.companyId`.

Además, editar `Employee.role` o `Employee.isActive` solo actualiza el empleado: no actualiza la `Membership` que realmente determina el acceso. Crear un empleado para un usuario existente tampoco sincroniza el rol de su membresía. Los roles mostrados y los permisos reales pueden divergir incluso después de volver a iniciar sesión.

**Demostración:** `AuthService.login` aceptó contraseña válida de un usuario sintético con `isActive: false`.

**Corrección:** comprobar usuario/membresía activos en login y refresh, definir revocación de access tokens mediante versión de sesión o validación de estado con TTL acotado, y sincronizar empleado/membresía en una transacción. No usar un tenant anterior cuando la membresía deja de existir.

### B-05. Consumo concurrente de tokens

**Referencia:** `src/modules/auth/auth.service.ts:205-314,385-418`.

Se lee el token y se verifica `revokedAt` antes de la transacción. La escritura posterior utiliza `update({id})` sin condicionar a `revokedAt: null`. Dos solicitudes simultáneas pueden superar la lectura inicial y emitir dos refresh tokens de la misma familia. Un reset token también puede superar dos verificaciones concurrentes antes de consumirse.

**Corrección:** reclamar el token con `updateMany` condicional dentro de la transacción, comprobar `count === 1` y emitir el reemplazo únicamente tras esa reclamación. La detección actual de reutilización secuencial es positiva, pero no sustituye esta condición.

### B-06. “Solo mis ventas” no se aplica a todas las lecturas

**Referencias:** `src/modules/sales/sales.service.ts:70-145`; `src/modules/invoices/invoices.controller.ts:83-94`; `src/modules/invoices/invoices.service.ts:251-269`; `src/modules/customers/customers.controller.ts:65-69`; `src/modules/customers/customers.service.ts:36-70`; `src/modules/dashboard/dashboard.controller.ts:20-40`; `src/modules/dashboard/dashboard.service.ts:188-249`.

Listado y detalle de `/sales` sí filtran al cajero por `sellerId`. Sin embargo:

- Generar la boleta solo filtra `saleId + companyId` y admite CASHIER.
- El historial de compras de un cliente devuelve ventas de cualquier vendedor de la empresa y admite CASHIER.
- Dashboard devuelve ventas recientes y métricas de toda la empresa sin filtrar por vendedor.
- REPORT_SALES también está concedido al cajero; el reporte es de empresa.

No es acceso entre empresas, pero sí contradice la política comunicada de que un cajero únicamente consulta sus ventas. El historial de clientes/dashboard puede facilitar IDs para generar boletas de otros vendedores.

**Corrección:** definir explícitamente el alcance de cada rol y reutilizar un filtro de visibilidad común en todas las rutas. Si ciertos agregados son deliberadamente compartidos, documentar esa excepción y evitar exponer ventas individuales fuera de alcance.

### B-07. Importes negativos y precio de presentaciones

**Referencias:** `src/modules/sales/dto/sale.dto.ts:23-31,54-62`; `src/modules/sales/sales.service.ts:325-340,389-443`; `frontend/components/sales/sale-form.tsx:223-228`.

`taxAmount` y `discountAmount` no tienen mínimo y el servicio no exige `totalAmount >= 0` ni limita descuento al subtotal. Una solicitud con subtotal 10 e impuesto -100 superó validación y generó total **-90** en la demostración local. Un descuento manual excesivo también puede producir total negativo cuando el plan admite descuentos.

Si una presentación no tiene precio propio, el frontend calcula `precioBase × factor`, pero el backend usa solo `product.salePrice`. Una caja de factor 12 puede descontar 12 unidades de stock y cobrar una sola.

**Corrección:** calcular importes autorizados en servidor, validar reglas no negativas/descuento máximo y definir el precio de cada presentación con la misma regla en ambos lados. Comprobar también límites de precisión y redondeo monetario.

### B-08. Recepción de órdenes de compra incompleta

**Referencias:** `src/modules/suppliers/suppliers.service.ts:521-622`; `src/modules/suppliers/dto/supplier.dto.ts:259-272`.

- Se crea/confirma la entrada de stock antes de la transacción que marca la orden recibida. Si la segunda parte falla, queda stock ingresado y orden reintentable.
- Dos recepciones pueden leer la misma orden abierta y crear entradas independientes antes de cambiar su estado.
- No se comprueba que todos los productos recibidos correspondan a la orden ni se condiciona el cambio de estado al estado leído.
- No se pasa `supplierId` a la entrada, perdiendo trazabilidad por proveedor.
- El endpoint de cambio de estado permite `CONFIRMED` sin ejecutar recepción; luego `receiveOrder` lo trata como “ya recibida”.

**Corrección:** una sola transacción para reclamar orden, validar líneas, crear entrada, actualizar costos y marcar recepción. Separar confirmación comercial de recepción física, y establecer una clave única/idempotente entre orden y entrada.

### B-09. Carreras de inventario y saldo

**Referencias:** `src/modules/inventory/inventory.service.ts:117-165`; `src/modules/distributors/distributors.service.ts:522-574`.

El ajuste de inventario verifica stock antes de la transacción y luego aplica un incremento/decremento sin condición de stock suficiente. Dos salidas simultáneas pueden pasar la verificación. El registro de venta de distribuidor verifica un saldo leído fuera de la transacción y después lo decrementa sin condición de saldo.

En cambio, la venta POS sí utiliza `updateMany` con `stockQuantity >= cantidad` dentro de la transacción: esa protección debe extenderse a las otras salidas.

En el mismo registro de venta de distribuidor se persiste `dto.customerId` sin buscar primero ese cliente por `companyId`. Si se conoce un ID de cliente de otra empresa, la FK por ID no impone por sí sola la igualdad de tenant: puede vincularse una venta propia a un cliente ajeno. El detalle de ventas incluye `customer`, por lo que esa relación también puede convertirse en exposición de datos. La diferencia con POS es explícita: POS sí verifica la pertenencia del cliente antes de crear la venta.

**Corrección:** escrituras condicionales y comprobación de filas afectadas; considerar aislamiento y restricciones de no-negatividad. En distribuidores, validar `customerId` contra la misma empresa y controlar mercadería por producto, no solo saldo total. Añadir una prueba negativa con el cliente de un segundo tenant.

### B-10. Devolución y nota de crédito no cierran todo el ciclo

**Referencias:** `src/modules/sales/sales.service.ts:587-717`; `src/modules/credit-notes/credit-notes.service.ts:230-274`.

- `reverseSale` usa el factor actual de la presentación, no un factor histórico guardado en la venta.
- Aplica el mismo retorno al stock central en ventas DISTRIBUTOR, sin revertir el saldo/vendido del distribuidor.
- El fallo de emisión de nota de crédito se captura sin reintento ni estado “pendiente”, por lo que puede existir reembolso sin documento asociado.
- La nota de crédito reutiliza todo el impuesto de la venta y no descuenta el descuento original; en devoluciones completas o parciales puede diferir del importe realmente cobrado.

**Corrección:** guardar cantidades base y condiciones económicas históricas, modelar devolución por canal y emitir nota dentro de la misma transacción o mediante outbox reintentable. Validar el importe máximo que puede acreditarse y su tratamiento tributario.

### B-11. Ciclo anual perdido en cambio de plan

**Referencia:** `src/modules/subscriptions/plan-upgrade-requests.service.ts:159-197,439-477`.

La solicitud elige importe mensual/anual desde `input.billingCycle`, pero no persiste ese ciclo en la solicitud. La aprobación calcula vigencia con `plan.billingCycle`. Si el plan tiene ciclo MONTHLY y se solicitó/pagó precio anual, puede activarse solo un mes.

Además, el pago creado como `SUCCEEDED` no asigna `paidAt` en esa ruta. Ese `null` es permitido por el modelo, pero incompleto para un cobro ya confirmado.

**Corrección:** conservar ciclo, importe y vigencia solicitados como snapshot, usarlos en la aprobación y completar fecha de pago.

### B-12. Hash de contraseña en respuestas administrativas

**Referencias:** `src/modules/platform/platform-admins.service.ts:55-91`; `src/modules/platform/platform-admins.controller.ts:36-64`.

Promover/revocar devuelve un `User` completo desde `findUnique` o `update`, incluyendo `passwordHash`; el controlador retorna directamente ese objeto. El endpoint está restringido a administración de plataforma: **no se afirma exposición pública**, pero el hash no debe salir de la capa de autenticación ni llegar a navegador, logs o extensiones.

**Corrección:** usar el mismo `select` público del listado también en todas las ramas de escritura/retorno. Añadir una prueba que garantice ausencia de `passwordHash` en respuestas.

### B-13. Notificaciones de empresa demasiado amplias

**Referencias:** `src/modules/notifications/notifications.controller.ts:56-64`; `src/modules/notifications/notifications.service.ts:283-300`.

`GET /notifications/company` exige tenant pero no permiso de administración y busca por empresa y scope, no destinatario. Un cajero u otro usuario autenticado del tenant puede consultar avisos que estaban destinados a otras personas. `/notifications` personal sí está correctamente ligado a `userId`.

**Corrección:** limitar la consulta de empresa a roles autorizados, o devolver solo la audiencia del usuario. No reutilizar un endpoint de auditoría de notificaciones como bandeja personal.

### B-14. `null`, fechas y PATCH

**Referencias:** `src/modules/platform/dto/platform-finance.dto.ts`; `src/modules/platform/platform-finance.service.ts:408-421,489-535`; `src/modules/products/dto/product.dto.ts:173-175,226-232`; `src/modules/products/products.service.ts:328-342`; `src/modules/companies/companies.service.ts:22-27,224-244`.

`@IsOptional()` omite validación tanto para `undefined` como para `null`. No todos los servicios conservan esa distinción:

| Entrada                                   | Resultado observado o deducido directamente                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `initialBalance: null` en PATCH de cuenta | DTO sin errores; `new Prisma.Decimal(null)` lanza excepción. Demostrado localmente. Lo mismo debe revisarse en `amount: null`. |
| `expiryDate: "no-fecha"` de producto      | `@IsString` lo admite; `new Date` produce fecha inválida antes de persistir.                                                   |
| PATCH de producto sin `isActive`          | Asigna `true` por defecto; puede reactivar un producto inactivo sin solicitarlo.                                               |
| `categoryId: null` en producto            | Se convierte a `undefined`; no permite limpiar la categoría aunque el DTO declare `null`.                                      |
| PATCH parcial de empresa                  | `profileSync(input)` evalúa solo el fragmento enviado y puede marcar incompleto un perfil que estaba completo.                 |

**Corrección:** definir por campo si admite omisión, borrado o `null`; validar fechas con `IsDateString`, evitar defaults de creación en PATCH y recalcular atributos derivados con el estado completo persistido.

### B-15. Registro no atómico

**Referencia:** `src/modules/auth/auth.service.ts:77-144`.

Se crea la empresa antes de verificar el plan y se crean suscripción/usuario/membresía/sesión en pasos independientes. Un plan inexistente o un fallo posterior puede dejar empresa y suscripción sin propietario.

**Corrección:** validar previamente y crear el conjunto de dominio en una transacción; correo/notificación fuera del commit con outbox si deben garantizarse. Añadir prueba de rollback en fallos intermedios.

### B-16. Estado final guardado, respuesta HTTP fallida

**Referencias:** `src/modules/payments/payment-settings.service.ts:201-254`; `src/modules/payments/checkout-requests.service.ts:310-336`; `src/modules/subscriptions/plan-upgrade-requests.service.ts:349-381,480-499`; `src/modules/sales/sales.service.ts:530-545`.

- Un comprobante se marca aprobado antes de la transacción de activación. Si esa transacción falla, reintentarlo puede responder “ya revisado” aunque el proceso no finalizó.
- Subir comprobante de checkout guarda SUBMITTED y luego espera correo. Si el correo falla, el cliente recibe error y el reintento ya no es válido.
- Aprobar/rechazar upgrade persiste la decisión y después espera notificación/correo. Un fallo posterior puede ocultar al cliente que la aprobación ya ocurrió.
- Una venta ya confirmada espera alertas de stock; un fallo no aislado puede producir error después de guardar y motivar un segundo registro.

**Corrección:** separar éxito del dominio de los efectos auxiliares, usar outbox/colas con reintentos y permitir consultar el resultado de una solicitud idempotente. No reportar un fallo total cuando solo falló un aviso.

### B-17. Reportes y finanzas no siempre representan el universo consultado

**Referencias:** `src/modules/reports/reports.service.ts:69-123,139-159`; `src/modules/finance/finance.service.ts:71,112-115,164-213,222-248`.

- El reporte suma ventas sin excluir CANCELLED/REFUNDED; la serie usa una consulta distinta de los filtros de fechas y solo las últimas 1000 ventas.
- Finanzas de empresa mezcla filas manuales y ventas con tope de 500 por fuente, pero informa un total completo; páginas avanzadas pueden quedar vacías o incompletas.
- El resumen de finanzas de empresa no selecciona/agrupa moneda, aunque los registros permiten `currency`.
- Métricas de dashboard y listados también emplean topes y no deben presentarse como totales exhaustivos.

**Corrección:** compartir filtros de estado/rango, agregar en BD, separar monedas y devolver paginación real con un criterio estable. Indicar explícitamente cualquier muestra truncada.

### B-18. Inyección de fórmulas en CSV

**Referencia:** `src/common/helpers/export.helper.ts:25-44`.

Se escapan comillas, saltos y comas, pero no valores iniciados por `=`, `+`, `-`, `@` o controles relevantes para hojas de cálculo. Un nombre o descripción exportado puede interpretarse como fórmula al abrir el CSV.

**Demostración:** una celda sintética `=1+1` se exportó sin neutralizar. No se ejecutó la fórmula ni una aplicación de escritorio.

**Corrección:** neutralizar celdas de texto según el destino de hoja de cálculo y conservar tipos numéricos legítimos. No confundir escape CSV con escape de fórmulas.

### B-19. Consultas, DTOs incompletos y cuota concurrente

**Referencias:** `src/modules/payments/payments.controller.ts:39-50,86-98,118-129`; `src/modules/payments/payments.service.ts:54-73,264-275`; `src/modules/platform/platform-companies.controller.ts:39-42`; `src/modules/plan-capabilities/api-quota.service.ts:62-87`; `src/modules/support/support-chat.service.ts:140-149`; `src/modules/platform/platform-api-usage.service.ts:37-68`.

Hay paginaciones sin mínimo/máximo efectivo de servicio, parámetros escalares sin DTO y cuerpos declarados como interfaces que no reciben el whitelist de una clase. Chat obtiene todos los mensajes; varios listados, exportaciones y resúmenes cargan colecciones completas en memoria. Los topes existentes no son uniformes.

La cuota API lee consumo, compara y después incrementa: varias solicitudes pueden superar simultáneamente el límite. Se consume antes de completar la consulta externa, sin distinguir fallo de proveedor/caché. El throttling global está configurado sin un almacenamiento distribuido explícito; no debe asumirse un límite común entre réplicas.

**Corrección:** DTOs concretos para query/body, máximos de filas y rangos, cursores para mensajes y exportación por lotes. Reclamar cuota atómicamente y definir si se factura intento o resultado exitoso.

### B-20. Readiness y SSE

**Referencias:** `src/modules/health/health.controller.ts:19-35`; `src/modules/health/health.service.ts:44-65`; `src/modules/notifications/notifications.controller.ts:25-43`.

Readiness devuelve un cuerpo `degraded` con HTTP 200: un balanceador que solo comprueba HTTP puede considerar listo un servicio sin BD. El stream de notificaciones autentica al abrir, pero no tiene heartbeat, tiempo máximo ni una comprobación periódica de expiración/revocación.

**Corrección:** readiness con 503 ante dependencia crítica no disponible; definir qué degradaciones son tolerables. SSE con heartbeat, caducidad/reautenticación y límites por usuario. No se probó agotamiento de conexiones.

### B-21. Errores funcionales pierden metadatos

**Referencia:** `src/common/filters/all-exceptions.filter.ts:155-188`.

La normalización conserva `message`, `error`, `code`, pero elimina `limit`, `used`, `remaining`, `modules`, `currentPlan`, `upgradeUrl`, etc. que algunos guards envían. El frontend no puede diferenciar adecuadamente algunos casos ni mostrar el contexto previsto.

**Demostración:** una excepción sintética con límite y URL de upgrade perdió esos campos al pasar por el filtro real.

**Corrección:** un contrato de error explícito, con una lista permitida de detalles públicos. No devolver la excepción interna completa como solución.

### B-22. Dependencias

**Comando ejecutado:** `npm audit --omit=dev --json` en `backend`.

Resultado del registro consultado: **17 entradas: 1 crítica, 10 altas y 6 moderadas**. Son entradas de paquetes y cadenas de dependencias; no representan 17 explotaciones demostradas ni 17 fallos independientes.

| Componente destacado                                          | Aviso / lectura técnica                                                                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proxy-addr`                                                  | Crítica, [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). Revisar versión y aplicabilidad a la configuración real de proxy; la aplicación usa `trust proxy = 1`, no una lista de subredes auditada aquí. |
| `@nestjs/platform-express` / `multer`                         | Altas por DoS/validación de multipart. No se encontraron endpoints `FileInterceptor`/Multer en el código revisado: la ingestión actual es JSON/Base64, por lo que no debe darse por demostrada esa explotación.                   |
| `nodemailer`                                                  | Altas en la rama instalada por inyección/normalización y otras condiciones específicas. Revisar opciones realmente utilizadas; no se demostró inyección SMTP en la aplicación.                                                    |
| `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`          | Alertas altas en la cadena. PostgreSQL es el motor utilizado; distinguir dependencias de CLI/build de las alcanzables por una petición.                                                                                           |
| `body-parser`, `qs`, `js-yaml`, `fast-uri`, `brace-expansion` | Revisar límites, parseo y versiones transitivas.                                                                                                                                                                                  |
| `exceljs`, `mercadopago`, `uuid`                              | Avisos transitivos moderados. El scanner propone algunos cambios mayores o downgrades: no aplicarlos sin evaluar compatibilidad.                                                                                                  |

Actualizar en una rama específica con lockfile, pruebas de imágenes/pagos y builds. No se ejecutó `npm audit fix` ni se cambiaron versiones durante esta revisión.

### B-23. Solicitudes válidas de cambio de plan rechazadas por su ID

**Referencias:** `prisma/schema.prisma:831-856`; `src/modules/subscriptions/plan-upgrade-requests.controller.ts:44,80`; `src/modules/platform/platform-upgrade-requests.controller.ts:42`.

`PlanUpgradeRequest.id` usa `@default(cuid())`, pero los parámetros de subida de comprobante/revisión tienen `ParseUUIDPipe`. Una solicitud creada correctamente por Prisma puede recibir 400 antes de llegar al servicio. Las pruebas de servicio no detectan este fallo de la capa HTTP.

**Demostración:** se ejecutó el pipe real con un identificador de formato CUID y fue rechazado. No se hizo una solicitud de cambio de plan contra producción.

**Corrección:** alinear generador, validación y contratos; añadir prueba E2E que use el ID realmente devuelto por la creación. Una vez reparado, también debe corregirse el ciclo anual descrito en B-11.

### B-24. Creación/default de plantillas no coincide con el modelo

**Referencias:** `prisma/schema.prisma:859-895`; `src/modules/invoices/invoices.service.ts:61-115`.

El esquema declara `content String` obligatorio y sin default. La creación construye un objeto `any` sin ese campo, por lo que no satisface el contrato Prisma. Además, si `input.isDefault` es verdadero, desmarca los otros defaults pero no añade `isDefault` al objeto creado. Puede perderse la selección predeterminada aunque después falle el alta.

**Demostración:** la creación con repositorio simulado confirmó que el payload no incluía `content` ni `isDefault: true`. La obligatoriedad se verifica en el esquema; no se escribió una plantilla inválida en la BD.

**Corrección:** decidir el uso del campo legado `content`, alinear DTO/modelo, evitar `any` en el input de Prisma y realizar alta/cambio de default en una transacción. Probar el endpoint, no solo la previsualización del editor.

## 5. Consultas y respuestas: evaluación transversal

| Superficie                | Estado observado                                                                                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL/ORM                   | No se localizaron `$queryRawUnsafe`/`$executeRawUnsafe` ni SQL concatenado en `src`; la consulta raw localizada es el literal `SELECT 1` del healthcheck. Prisma parametriza valores, pero no decide permisos.                                                                                       |
| Recursos de empresa       | La práctica habitual es `id + companyId`; los errores encontrados incluyen relaciones externas de distribuidor y acciones globales de FAQ. Revisar todas las nuevas relaciones con pruebas de dos tenants.                                                                                           |
| Acceso anónimo            | Registro/login/refresh/reset, catálogo de planes/pagos públicos, checkout y healthchecks están explícitamente abiertos. El webhook exige su firma. Subir prueba de checkout invitado se apoya en un ID difícil de adivinar, sin token de posesión separado; conviene añadirlo y limitar intentos.    |
| Proyección de respuestas  | Hay buenos `select` para usuarios de soporte y vendedor. La excepción confirmada de hashes está en B-12. Respuestas de pagos devuelven modelos completos con `providerPayload`; conviene establecer un DTO público para no exponer futuros datos del proveedor.                                      |
| HTTP/XSS/SSRF             | Helmet, CORS por allowlist y exigencia de JSON para mutaciones son positivos. Las boletas escapan textos HTML y restringen la fuente con DTO. No se encontró fetch de imágenes desde una URL entregada por el usuario. Request smuggling y configuración de borde requieren revisión del despliegue. |
| CORS/CSRF                 | No se identificó un bypass de navegador demostrado. `CsrfGuard` solo exige JSON; su protección depende también de CORS. Añadir validación de Origin/Fetch Metadata para mutaciones con cookie es endurecimiento, no evidencia de un ataque ya confirmado.                                            |
| Texto con “instrucciones” | No se localizaron `eval`, ejecución de comandos ni un endpoint que convierta texto de cliente en SQL o instrucciones de sistema. Debe mantenerse la separación entre dato y acción.                                                                                                                  |
| `null` y no encontrado    | `findById` de algunos recursos retorna `null` con 200 y otros usan 404. Unificar el contrato; un campo opcional legítimo no es una vulnerabilidad por ser `null`.                                                                                                                                    |

## 6. Cobertura por área y procesos pendientes

| Área revisada                                    | Evaluación resumida                                                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth, usuarios, empleados, roles                 | B-04/B-05/B-12/B-15; protección criptográfica presente, ciclo de permisos incompleto.                                                                                                                                           |
| Empresas y perfil                                | Tenant/control de plataforma presentes; PATCH de perfil y creación parcial a revisar.                                                                                                                                           |
| Productos, categorías, presentaciones            | CRUD con roles/tenant; imágenes robustas; B-07/B-14 y posibles estados inactivos reutilizados requieren pruebas.                                                                                                                |
| Ventas, boletas y clientes                       | Protección de stock POS positiva; B-06/B-07/B-10. Plantillas globales también están bajo TenantGuard, por lo que un SUPER_ADMIN sin empresa puede no administrarlas; la UI no debe asumir acceso global si la API exige tenant. |
| Inventario, entradas, lotes, sucursales y kardex | Validación de pertenencia habitual; B-09 y sincronización de lotes/retornos requieren integración concurrente. Crear o editar cantidad disponible de un lote no equivale por sí solo a ajustar inventario central.              |
| Distribuidores, salidas y liquidaciones          | Transacciones parciales correctas, pero B-09/B-10; confirmar por producto y por canal todos los saldos al vender, devolver y liquidar.                                                                                          |
| Proveedores y compras                            | B-08; recepción necesita un único proceso atómico y estados inequívocos.                                                                                                                                                        |
| Pagos, checkout, upgrades y billing              | B-01/B-02/B-11/B-16. Varias rutas distintas administran comprobantes y activación, con reglas no equivalentes.                                                                                                                  |
| Reportes, dashboard y finanzas                   | B-06/B-17; reconciliar filtros, estados y monedas antes de usar las cifras como contabilidad final.                                                                                                                             |
| Finanzas/API de plataforma                       | Permisos estrictos y reclamación contable positivos; B-14/B-19. El registro manual de tokens no sustituye instrumentar APIs externas. No hay emisión fiscal ni estados contables avanzados completos.                           |
| Soporte/chat/FAQ                                 | Bandeja global con responsables; B-03. Conversión de chat a ticket no reutiliza el alta con SLA/notificación/asignación; los procesos no quedan equivalentes.                                                                   |
| Notificaciones, correo, cache y jobs             | B-13/B-16/B-20. `suspendOverdue` solo suspende empresa y deja suscripción PAST_DUE, lo que puede repetir avisos en ejecuciones futuras. Correo/caché no deben determinar éxito del dominio ya confirmado.                       |

Esta matriz describe revisión transversal y los flujos inspeccionados. No sustituye una prueba E2E de cada combinación de rol, plan y estado para todos los endpoints.

## 7. Verificaciones ejecutadas

| Verificación                                                                    | Resultado                                                                                                                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint` backend                                                          | Aprobado en ejecución individual.                                                                                                            |
| Imágenes e ingestión + guards Roles/Tenant/Platform, con `--test-concurrency=1` | **28 pruebas aprobadas, 6 suites, 0 fallos**.                                                                                                |
| Primera ejecución paralela de lint y un conjunto más amplio de pruebas          | Timeout a 300 s. No se contabiliza como aprobado ni como fallo funcional demostrado; se reintentó secuencialmente con el resultado indicado. |
| Mock de FAQ global                                                              | Modificación aceptada para actor de empresa con permiso actual.                                                                              |
| Mock de pago pendiente                                                          | Autoconfirmación ejecutó activación de empresa y suscripción.                                                                                |
| DTO y venta con impuesto negativo                                               | 0 errores de validación; total persistido simulado -90.                                                                                      |
| DTO `initialBalance: null`                                                      | 0 errores de validación; excepción Decimal en servicio.                                                                                      |
| Webhook con igual firma y distinto cuerpo                                       | Se aceptaron dos destinos de negocio diferentes.                                                                                             |
| Login de usuario sintético desactivado                                          | Aceptado por la lógica de login.                                                                                                             |
| Identificador de upgrade                                                        | CUID rechazado por el pipe UUID utilizado en los controladores.                                                                              |
| Alta de plantilla con default solicitado                                        | Payload sin `content` ni `isDefault: true`; contrastado con el esquema requerido.                                                            |
| CSV y filtro de errores                                                         | Fórmula no neutralizada y metadatos eliminados, respectivamente.                                                                             |
| Auditoría de dependencias                                                       | 17 entradas, con las salvedades de B-22.                                                                                                     |

El control de integración previo sobre este mismo commit registró 166 pruebas completas y builds de backend/frontend aprobados. Esta revisión no volvió a ejecutar el build ni atribuye a esas pruebas cobertura de los fallos de negocio recién demostrados.

## 8. Orden de corrección y criterios de aceptación

### P0 — Cobro, permisos e identidades

- Empresa/cajero/gerente no pueden confirmar cobros de plataforma; debe responder 403 antes de escribir.
- Una notificación válida de proveedor no puede activar otra empresa/plan cambiando el cuerpo; verificar pago real e idempotencia.
- Una empresa no puede crear/modificar/eliminar GLOBAL ni acceder por feedback a FAQs TENANT ajenas.
- Usuario/membresía desactivados no pueden renovar sesión ni conservar permisos indefinidamente.
- Ninguna respuesta retorna `passwordHash`.
- Evaluar y actualizar dependencias críticas/altas alcanzables.

### P1 — Integridad de procesos

- Tests de dos empresas y dos vendedores para listado, detalle, boleta, compras y dashboard.
- Venta negativa rechazada y precio de presentación coherente entre interfaz y servidor.
- Recepción duplicada o fallo intermedio no incrementa stock dos veces.
- Pruebas concurrentes de salida, venta de distribuidor, refresh/reset y cuota de API.
- Devolución conserva cantidades históricas y produce una nota por el importe correcto o un estado pendiente reintentable.
- Ciclo anual queda guardado y activado por su duración correcta.
- El ID devuelto por el alta de upgrade permite subir comprobante y revisar; el alta de plantilla cumple campos requeridos y establece default de forma atómica.

### P2 — Contratos y operación

- DTOs concretos, esquema de errores público, política explícita de `null`/omisión y 404 uniforme.
- Paginación real, límites de consulta, agregados por moneda/estado y CSV neutralizado.
- Outbox de notificaciones/correos, readiness con código correcto y SSE recuperable/caducable.
- Suite HTTP E2E con JWT/cookies reales y matriz de roles/planes/estados; las pruebas de servicios con mocks no reemplazan esa capa.

## 9. Resultado de esta entrega

Se entrega el informe y su contraparte de frontend. Los hallazgos aquí listados **no se corrigieron en el código durante esta revisión**; no se cambiaron dependencias, permisos, migraciones ni datos de negocio para producir el informe.
