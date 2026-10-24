# Refix backend — Fase 2: B-05 a B-08

## Estado e integración

Las mitigaciones de esta fase están implementadas y la suite combinada de backend pasó **234 pruebas en 69 suites, sin fallos**. La generación de Prisma, lint y build también aprobaron.

Durante el trabajo, los avances de las fases 1 y 2 fueron guardados juntos en el commit local `4dec103`, cuyo mensaje es `(refix):Backend-fase-1`. Después se fusionó `main` dentro de esa rama mediante `e02cbfa`.

Esa fusión actualizaba la rama de correcciones, pero no actualizaba `main`. Para completar la integración:

1. Se verificó que `main` y `origin/main` apuntaban a `4999dcd`.
2. Se actualizó `refix/backend-fase-2` mediante avance directo desde `refix/backend-fase-1`.
3. Se ejecutaron generación de Prisma, lint, build y regresión completa sobre `e02cbfa`.
4. Se avanzó `main` hasta `e02cbfa` con `git merge --ff-only refix/backend-fase-2`.
5. Se comprobó que todas las ramas locales existentes eran ancestros de `main`, incluidas las tres `feature/*` y las dos fases backend.

No hubo conflictos en esa integración, no se reescribieron commits y no se hizo push. Esta descripción registra las operaciones de integración realizadas; no significa que se hayan desplegado las mitigaciones.

## B-05 — Ciclo de vida de tokens

### Mitigación

- Se incorpora `authVersion` a usuarios y tokens persistidos. El access token también lleva la versión con la que fue emitido.
- La estrategia JWT contrasta la versión actual y la familia de sesión. Una credencial antigua no se acepta solo porque todavía exista un registro de familia.
- El reset reclama el token mediante una escritura condicional: tipo RESET, sin revocar, no vencido y con la versión esperada.
- Cambio de hash, avance de versión y revocación de sesiones/tokens de recuperación se ejecutan en la misma transacción SERIALIZABLE.
- Un reset concurrente tiene un único ganador. Si falla una escritura posterior, se revierten también el consumo del token y el cambio de contraseña.
- Refresh valida identidad y membresía dentro de la transacción, consume una única vez el token y crea el reemplazo con la versión vigente.
- La reutilización de un refresh consumido revoca su familia; esa revocación se confirma antes de devolver el rechazo.
- Logout y emisión de sesiones participan en el mismo mecanismo transaccional. La emisión comprueba que el usuario siga activo y conserve la versión validada.
- Tras un cambio/reset exitoso, el controlador elimina las cookies de autenticación.

La política de replay es estricta: repetir un refresh ya utilizado invalida la familia. La coordinación de renovaciones entre pestañas corresponde al flujo frontend de sesión, no debe resolverse volviendo a aceptar tokens consumidos.

### Pruebas

`auth-token-lifecycle.spec.ts`, `jwt.strategy.spec.ts` y `payment-security-http.spec.ts` verifican consumo concurrente, rollback, versiones antiguas, revocación de tokens hermanos, competencia entre refresh/logout, rechazo HTTP de JWT antiguos y borrado de cookies.

## B-06 — Visibilidad consistente de ventas

### Política común

`sales-visibility.helper.ts` define el alcance del actor:

- SUPER_ADMIN, COMPANY_ADMIN y MANAGER: ventas de la empresa del contexto autorizado.
- Otros actores autorizados a consultar ventas: únicamente `sellerId` del usuario actual.
- Sin actor válido o sin empresa: rechazo; no existe un fallback implícito a consultar todas las ventas.

La política se aplica en:

- Listado, detalle y exportación de ventas.
- Generación de boletas.
- Historial de compras de clientes.
- Métricas y gráficos de dashboard del tenant.
- Reportes de ventas, incluidas sus agregaciones relacionadas.

Los controladores construyen el actor a partir de `CurrentUser`, no del cuerpo o query del cliente. El tenant sigue procediendo de la sesión validada.

### Caché y contrato

Dashboard y reportes utilizan claves nuevas `v2`, separadas por empresa y audiencia: vista de empresa o vendedor concreto. Esto evita tanto reutilizar los resultados de otro cajero como consumir las claves antiguas que no tenían ese aislamiento.

Los resultados de dashboard incluyen `salesScope`; en reportes aparece en `filters.salesScope`. Sus valores son `COMPANY` o `SELLER`. Los datos generales de catálogo/inventario/clientes que ya son compartidos por los permisos del tenant no se convierten por ello en datos personales del vendedor.

### Pruebas

`sales-visibility-http.spec.ts` usa HTTP local, JWT firmados, guards y servicios reales con un repositorio simulado de dos empresas y dos cajeros. Verifica boletas/detalles ajenos con 404, historial filtrado y aislamiento de las cachés al consultar sucesivamente como cajero A, cajero B y administrador.

La exactitud de todos los filtros estadísticos, topes y monedas de los reportes sigue siendo una tarea distinta, B-17. No se presenta esta corrección de alcance como una conciliación contable completa.

## B-07 — Importes y presentaciones

### Reglas de cálculo

`sale-pricing.helper.ts` centraliza resolución de líneas y reglas monetarias:

- Impuestos y descuentos no pueden ser negativos, no finitos, nulos explícitos ni exceder la precisión admitida.
- El descuento no puede superar el subtotal; el total no puede ser negativo ni exceder la capacidad de persistencia.
- Se calcula el subtotal desde precios de servidor, usando Decimal y redondeo explícito por línea.
- Si una presentación no tiene precio propio, su precio es `precio base × factor`.
- Las cantidades base se normalizan a la precisión de inventario; no se admite cobrar una cantidad que termine representada como cero unidades base.
- Líneas idénticas del mismo producto se consolidan. No se mezclan silenciosamente presentaciones o precios diferentes del mismo producto, porque el modelo mantiene unicidad por producto en la venta.
- Se rechazan presentaciones inactivas y productos no disponibles.
- Los descuentos por línea que el DTO antes aceptaba sin implementar dejan de aceptarse como una operación ficticia.

Se conserva el campo de impuesto explícito validado; no se inventa una tasa tributaria nueva a partir de una plantilla de impresión. La política fiscal debe ser uniforme con la configuración de negocio correspondiente.

### Canal distribuidor

- El DTO acepta presentación y cantidad fraccionaria con precisión controlada.
- Se utilizan las mismas reglas de presentación, cantidades base e importes.
- Se preserva el precio negociado opcional del endpoint de distribuidor, reservado a sus actores administrativos autorizados; no se introduce como precio libre del POS.
- La ruta general de ventas ya no permite a un cajero utilizar el canal distribuidor para eludir su permiso específico. También comprueba la disponibilidad del módulo.
- El cliente relacionado debe pertenecer a la misma empresa.
- Los descuentos requieren la capacidad correspondiente del plan.
- El saldo total se reclama con una condición de cantidad suficiente dentro de la escritura. El detalle de existencias por producto del distribuidor sigue siendo parte de B-09.

### Persistencia y pruebas

Las nuevas ventas guardan `baseQuantity` y `unitFactor` en SaleItem, junto a sus importes históricos. No se reconstruyen snapshots de ventas antiguas usando factores actuales que podrían haber cambiado. El uso de esos snapshots para todas las devoluciones se completa en B-10.

`sale-pricing.helper.spec.ts` cubre precios por factor, precio propio, negociado autorizado, repetición/conflicto de líneas, valores negativos/no finitos, precisión, stock representable y DTO del canal distribuidor.

## B-08 — Recepción atómica e idempotente de compras

### Unidad de trabajo

La recepción ejecuta, dentro de una transacción SERIALIZABLE:

1. Consulta de la orden del tenant y validación de estado/líneas.
2. Reclamación condicional de una orden pendiente.
3. Creación de la entrada con su proveedor.
4. Actualización de stock, movimientos y kardex.
5. Actualización de cantidades recibidas y costos.
6. Vínculo único orden–entrada y registro del fingerprint de recepción.
7. Auditoría de la entrada y de la orden utilizando el mismo cliente transaccional.

`StockEntriesService.createWithinTransaction` permite componer este proceso sin abrir otra transacción independiente. Las entradas manuales conservan su wrapper transaccional. Los procesos de stock disponen de un presupuesto acotado de 60 segundos; pagos y autenticación mantienen su presupuesto menor.

### Idempotencia y estados

- La orden identifica la operación; un fingerprint canónico de líneas, cantidades, costos y datos de recepción distingue un reintento idéntico de otro contenido.
- Un reintento idéntico devuelve la recepción existente con `alreadyReceived: true`, sin volver a sumar stock.
- Un reintento modificado devuelve conflicto.
- `CONFIRMED` se conserva como estado final de recepción para mantener el contrato actual. Ya no se puede llegar a él con un simple cambio de estado sin ejecutar la recepción.
- No se permite cancelar o devolver a pendiente una orden físicamente recibida.
- La recepción actual es completa: debe incluir una vez cada producto y las cantidades solicitadas. Una recepción parcial no se marca falsamente como completa; se rechaza hasta implementar un flujo específico de parciales.
- `requestedQuantity` no se sobrescribe. La cantidad realmente recibida se guarda en `receivedQuantity`.

Las órdenes históricas confirmadas sin vínculo/fingerprint no se reciben de nuevo automáticamente: requieren conciliación para evitar duplicar entradas que pudieran existir antes de la reparación.

### Pruebas

`suppliers-reception.service.spec.ts` ejecuta SuppliersService junto al StockEntriesService real sobre un repositorio transaccional simulado. Comprueba una sola transacción, proveedor vinculado, stock/kardex/auditoría, reintentos simultáneos, rollback tras un fallo de costos, líneas inválidas y competencia con cancelación.

## Migraciones preparadas

| Migración                                   | Finalidad                                                          |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `20261101000000_auth_versions`              | Versiones de credenciales en User y RefreshToken, inicialmente 0.  |
| `20261101010000_sale_item_unit_snapshots`   | Cantidad base y factor históricos, nullable para datos anteriores. |
| `20261101020000_supplier_receipt_integrity` | Vínculo único orden–entrada, fingerprint y cantidades recibidas.   |

La migración de recepción inicializa las cantidades recibidas de órdenes que ya tenían fecha de recepción. No inventa su vínculo de entrada ni su fingerprint histórico.

No se ejecutó `migrate deploy` contra la base compartida durante este trabajo. Las migraciones deben aplicarse en el entorno donde se ejecute el backend actualizado antes de usar campos nuevos. La generación del cliente y el build no aplican esos cambios a PostgreSQL.

## Verificación registrada

- `prisma generate`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: aprobado.
- Suite completa: **234 pruebas, 69 suites, 0 fallos, 0 canceladas**.
- Comando de regresión: `node -r ts-node/register -r tsconfig-paths/register --test --test-concurrency=2 "src/**/*.spec.ts"`.
- Tras integrar, el árbol de código de `main` es el mismo que el de la revisión verificada `e02cbfa`.

Las pruebas de concurrencia con repositorios simulados verifican fronteras transaccionales, rollback e idempotencia de la lógica. La prueba de carga/concurrencia contra PostgreSQL real y los recorridos de navegador quedan pendientes para la preparación del despliegue.

## Continuación

La siguiente fase es B-09 a B-12. Debe conservar estos cambios al abordar saldos detallados/inventario, devoluciones y notas de crédito, ciclo anual de upgrades y proyecciones públicas de usuarios. La integración local aquí descrita no publica automáticamente `main` en el remoto.
