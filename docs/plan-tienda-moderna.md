# Plan por fases: tienda moderna, compra y validación

## Objetivo

Modernizar el portal comercial conservando sus colores crema/verde petróleo y su modo oscuro. Priorizar productos, selección de cantidades y una compra comprensible desde móvil. Reforzar los formularios sin confundir validación visual con protección del servidor.

## Flujo de ramas

Las ramas son encadenadas: cada fase nace del commit final de la anterior. Antes de cambiar de rama se verifican y confirman sus cambios. Al completar las pruebas se integra el resultado en `main` por fast-forward. No se reescribe historial ni se incluyen credenciales. La publicación remota es independiente de esta integración.

| Fase | Rama | Alcance | Estado |
| --- | --- | --- | --- |
| 1 | `fase/01-tienda-moderna-plan` | Diagnóstico y este documento | Completada |
| 2 | `fase/02-tienda-moderna-catalogo` | Identidad, metadatos, tarjetas, distribución y cantidades | Pendiente |
| 3 | `fase/03-tienda-moderna-formularios` | Formularios, navegación, carrito, entrega y pago | Pendiente |
| 4 | `fase/04-tienda-moderna-validacion` | Validación del servidor, pruebas de límites y aislamiento; verificación final | Pendiente |

## Fase 2: catálogo e identidad

- Tarjetas centradas en imágenes, con precio y una acción principal; retirar botones de cantidad duplicados.
- Distribución adaptable, filtros claros y estados de búsqueda/carga/vacío.
- Cantidad y presentación con controles compactos, accesibles y límites coherentes con el servidor.
- Nombre real de la compañía en cabecera y título de pestaña, por sección. La URL conserva el `slug` existente: cambiarlo rompería enlaces y no equivale a cambiar el título del navegador.
- Tokens visuales propios de tienda, contraste en ambos temas y objetivos táctiles adecuados.

## Fase 3: formularios y compra

- Etiquetas, ayudas, errores por campo y estados de envío consistentes en registro, ingreso, recuperación, restablecimiento, perfil y direcciones.
- Confirmación de contraseña en registro/restablecimiento; no reenviar campos de interfaz a la API.
- Conservar datos tras errores y evitar dobles envíos. No insertar contraseñas/documentos en URLs o mensajes.
- Entrega listada con dirección de retiro, cobertura y costo. Solo mostrar métodos habilitados por la compañía; pago compatible con la entrega.
- Resumen de compra y cotización vinculados a las selecciones actuales; el servidor conserva la autoridad sobre precios y existencias.
- Revisar también formularios de configuración comercial y de atención de pedidos para evitar datos de formulario sin validar.

## Fase 4: validación y pruebas

- Normalizar correos y espacios de texto, sin modificar contraseñas.
- Aplicar tipos, longitudes, formatos de documento/teléfono/ubigeo, identificadores y números finitos con precisión acotada.
- Rechazar campos adicionales y contenido de marcado/control en campos de texto plano. Permitir nombres legítimos con apóstrofes y Unicode.
- Revisar SQL: mantener Prisma y parámetros vinculados; no construir SQL con texto del cliente ni prometer seguridad mediante listas de palabras prohibidas.
- Probar sobreasignación de empresa/precio, payloads malformados, búsquedas con caracteres SQL y aislamiento entre compañías/cuentas.
- Mantener respuestas públicas acotadas: sin hashes, tokens de sesión, credenciales, datos de otras cuentas ni errores internos.

## Criterios de aceptación

- Navegación, catálogo, carrito y formularios utilizables a 320/390/768/1440 px sin desbordamiento.
- Nombre correcto en pestaña y cabecera; búsqueda y paginación conservan alcance de tienda.
- Seleccionar, agregar, editar y retirar cantidades actualiza el carrito sin precios enviados por el cliente.
- Entrega y pago de la compañía se reflejan en la cotización y el pedido.
- Errores junto al campo, foco accesible y envío bloqueado cuando los datos no son válidos.
- Pruebas unitarias/HTTP e integración comercial pertinentes, smoke de navegador y builds de ambos proyectos aprobados.

## Registro de ejecución

- Base: `main`, commit `0f67e00`, árbol limpio.
- Diagnóstico: catálogo con controles repetidos; título genérico; formularios con límites HTML genéricos que no coinciden con los DTOs; el servidor ya usa Prisma, validación global, sesiones comerciales y filtros por compañía.
- Skills utilizadas: `frontend-design`, `next-best-practices`, `nestjs-best-practices`, `ui-ux-pro-max`.
