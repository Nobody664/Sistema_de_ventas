# Implementación del portal comercial

## Ramas y entregas

| Rama | Fases | Estado |
| --- | --- | --- |
| `mejora/tienda-fases-1-3` | Identidad comercial, perfil/direcciones, publicación y catálogo | Implementado: lint de ambos proyectos y 3 pruebas de frontera aprobados |
| `mejora/tienda-fases-4-6` | Métodos, carrito/cotización, reservas | Implementado: lint, 6 pruebas comerciales y validación Prisma aprobados |
| `mejora/tienda-fases-7-10` | Pedidos/cobros, pasarela, entrega y validación | Pendiente |

Las ramas se encadenan para conservar las dependencias. La integración a `main` y el push se realizan al terminar la tercera rama.

## Decisiones de implementación

- Credenciales `User` compartidas y cuenta comercial por empresa; ningún comprador crea una membresía laboral.
- Estrategia Passport comercial seleccionada explícitamente por el guard global, audiencia `store` y clave derivada distinta de la laboral.
- Cookies comerciales HttpOnly separadas; refresh rotativo con detección de reutilización.
- Verificación de correo, recuperación, datos personales y direcciones acotados a la cuenta; correo durable cifrado con arrendamiento y reintentos.
- Publicación explícita, desactivada por defecto; catálogo sin costos y proyecciones limitadas.
- El módulo `storefront` debe estar incluido en el plan de la empresa; la tienda además debe habilitarse desde el panel.

## Requisitos operativos

- SMTP operativo para entregar enlaces. Un correo no enviado nunca activa una cuenta.
- Mantener estables los secretos JWT: también protegen las sesiones y el contenido privado de la cola comercial mediante derivación de claves por propósito.
- Aplicar migraciones aditivas antes de iniciar esta versión y regenerar Prisma.

## Bloque 4–6

- Métodos de pago por empresa, entrega local por ubigeos, retiro, impuesto incluido/excluido y tarifa calculada por servidor.
- Carrito persistente con versión y una presentación por producto; cotización de cinco minutos con snapshots y validación de perfil.
- Reservas por producto/lote con cantidades base. Las restricciones de PostgreSQL impiden a cualquier salida (incluyendo POS, ajustes y distribuidores) reducir stock por debajo de lo reservado. El consumo normal de lotes utiliza solamente cantidades libres.
- La cotización no reserva. La creación/expiración de pedidos conecta el ciclo de vida de las reservas en el bloque siguiente.
- Pruebas ejecutadas sobre PGlite (motor PostgreSQL embebido): migraciones, relaciones entre empresas, competencia por unidades y restricciones de salida.
