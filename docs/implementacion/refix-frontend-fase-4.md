# Refix frontend — Fase 4

Rama: `refix/frontend-fase-4`, creada desde `main` (`d341386`, cierre de la Fase 3).

Alcance: F-13, F-14, F-15 y F-16 del informe técnico frontend del 23 de octubre de 2026.

## F-13 — Redirección después del login

- `lib/safe-redirect.ts` exige una ruta interna, valida decodificaciones sucesivas, rechaza barras invertidas, controles, autoridades externas y rutas de autenticación que provocarían un bucle.
- Compara el origen con una base interna y devuelve únicamente pathname, query y hash. También rechaza rutas que quedan con doble barra inicial después de normalizar segmentos.
- `sign-in-form.tsx` usa el helper. Las pruebas cubren rutas válidas con parámetros, espacios codificados, barras codificadas/repetidas, controles, normalización de segmentos, esquemas externos y login codificado.

## F-14 — CSP y contexto de impresión

- `proxy.ts` genera un nonce por petición de documento, lo reenvía al render de Next y fija una CSP en la respuesta. La política limita scripts a nonce y `strict-dynamic`, conexiones al mismo origen, fuentes locales, imágenes locales/data/blob/HTTPS, frames locales y formularios internos; prohíbe objetos y el embebido por terceros.
- Producción no usa `unsafe-eval` ni `unsafe-inline` para scripts. Desarrollo admite eval y WebSocket para las herramientas de Next. Los estilos inline siguen permitidos por las necesidades de estilos dinámicos/Radix y de las boletas.
- `RootLayout` lee los headers para que el documento se renderice con su nonce y lo pasa a `next-themes`. Esto convierte las rutas antes estáticas en SSR dinámico; el build sigue incluyendo las 62 rutas y los recursos estáticos conservan su entrega normal.
- La prueba en navegador detectó un probe de eval de Zod 4. `instrumentation-client.ts` configura `jitless: true` antes de la hidratación para que esa comprobación no viole la CSP.
- `lib/print-html.ts` centraliza la impresión en un iframe sandbox con `allow-same-origin allow-modals`, sin scripts, formularios ni navegación del contexto superior. El mismo origen permite al padre llamar a `print()`; no se concede `allow-scripts`.
- Ventas y boletas internas de compras usan este helper. Se elimina la ventana con acceso a opener y se limpian los frames tras imprimir o fallar la carga.

## F-15 — Día contable y zona horaria

- Se adopta `America/Lima` para las fechas elegidas por el operador. Como la API persiste un instante, un día `YYYY-MM-DD` se envía como el inicio de ese día en UTC−05:00 (`2026-10-23` → `2026-10-23T05:00:00.000Z`).
- `lib/business-date.ts` valida el calendario, convierte el día a instante y formatea tanto el input como la presentación en Lima, independientemente de la zona del navegador.
- Finanzas de plataforma y registro de consumo API usan el mismo contrato. Los formularios indican la zona contable y los períodos mensuales UTC permanecen identificados como tales.
- No se reinterpretaron registros históricos: un instante existente sigue representando el mismo instante; cualquier corrección histórica necesita identificar el día que quiso registrar el operador.

## F-16 — Props, teclado, tema y borradores

- Las primitivas de diálogo combinan clases internas y del llamador mediante `cn`; también se corrigen las primitivas de dropdown. El cierre del diálogo tiene etiqueta en español.
- La exportación de ventas usa el dropdown de Radix, con foco, teclado y activación táctil, conservando el guard de permisos.
- Las tarjetas de ventas y los fondos principales de solicitudes usan tokens de tema. El control para mostrar contraseña y el envío de chat tienen nombres accesibles.
- Chat y comentarios de tickets solo limpian el texto si sigue siendo el borrador enviado. Una respuesta tardía no borra texto nuevo.
- El chat anuncia un contador breve, no toda la conversación en cada polling, y solo desplaza al último mensaje si el usuario sigue cerca del final.

## Verificación

Desde `frontend`:

```text
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser:refix
npm audit --omit=dev
node node_modules/prettier/bin/prettier.cjs --check <archivos modificados>
git diff --check
```

Resultado: **38 pruebas unitarias aprobadas**, build correcto con **62 rutas dinámicas**, **0 vulnerabilidades de producción** y cinco comprobaciones funcionales en Chromium:

1. Documento con CSP/nonce y controles hidratados sin violaciones de política.
2. Impresión invocada con contenido y CSS conservados, script del documento bloqueado y frame eliminado.
3. Menú por Enter/flechas/Escape con restauración de foco, tema claro/oscuro y navegación cliente bajo CSP.
4. Diálogo que respeta el ancho personalizado del llamador y cierre por Escape.
5. Borrador nuevo conservado tras una respuesta de envío demorada, sin errores de página ni violaciones CSP.

`scripts/refix-browser-smoke.cjs` arranca el build de producción en `127.0.0.1:3317`, un backend simulado en `127.0.0.1:4407` y usa datos sintéticos. Esos puertos deben estar libres. Playwright es una dependencia de desarrollo. La prueba no escribe en una BD ni verifica autorización real del backend.

En la comprobación de impresión se intercepta la llamada nativa a `print()` para evitar un diálogo del sistema en headless; se verifican el documento, sus estilos y el sandbox en un navegador real. Sigue pendiente la revisión de salida física/PDF, lectores de pantalla y contraste visual de todas las pantallas históricas.

## Cierre

Fase 4 completada en commit local. Con esta fase quedan implementados F-01–F-16 en cuatro subramas secuenciales, verificadas y fusionadas localmente mediante fast-forward.
