# Análisis: decodificación y enriquecimiento de códigos de barras en el alta de productos

Fecha: 2026-10-31
Alcance: módulo de productos (`/products/new`, `/products/[id]/edit`) y lector por cámara.
Estado: Fases 1 y 2 implementadas; Fase 3 pendiente de validación.

---

## 1. Resumen ejecutivo

Hoy el escáner **sí decodifica** las barras y espacios del símbolo: `BarcodeDetector` devuelve el texto que contiene el código. Lo que falta es **interpretar ese texto** y **enriquecerlo** con datos de producto.

La conclusión técnica más importante es esta:

| Dato | ¿Viene dentro del código? | Cómo se obtiene |
| --- | --- | --- |
| Nombre del producto | **No** en EAN-13/UPC. Solo en QR/JSON propietario o GS1 Digital Link que apunte a una ficha | Consultar catálogo propio o un proveedor externo por GTIN |
| Marca | No en EAN-13 | Catálogo propio o proveedor externo |
| Fecha de vencimiento | **Solo** en GS1-128, GS1 DataMatrix, GS1 QR o GS1 Digital Link con AI `17`, `15`, `16` o `7003` | Parsear el AI correspondiente |
| Lote | Solo en GS1 con AI `10` | Parsear AI `10` |
| Peso/precio variable | Solo en GS1/DataBar con AI `310n`, `392n`, etc. | Parsear AI y aplicar decimales implícitos |
| Identificador global | **Sí**, GTIN en EAN-13/UPC/ITF-14 | Validar dígito verificador y normalizar a GTIN-14 |

Por tanto, no existe una fórmula que "extraiga el nombre" de un EAN-13: el EAN-13 solo identifica el artículo. El nombre y la fecha solo aparecen si el fabricante usó un símbolo GS1 con esos atributos o si consultamos una base de datos.

La solución recomendada es un **pipeline de parseo local + resolución de producto**:

1. Escanear y obtener `rawValue` **y** `format`.
2. Normalizar el texto (FNC1, prefijos AIM, paréntesis, URL).
3. Detectar el tipo: GTIN simple, GS1 element string, GS1 Digital Link, JSON/QR o código interno.
4. Validar (dígito verificador, fechas, longitudes, AIs conocidos).
5. Buscar el producto en el catálogo propio por GTIN/barcode normalizado.
6. Opcionalmente enriquecer desde un proveedor externo (servidor, con caché) y **pedir confirmación** antes de rellenar.
7. Precargar solo campos vacíos y nunca inventar precio, stock ni vencimiento.

---

## 2. Estado actual del módulo

### 2.1 Flujo actual

| Archivo | Rol |
| --- | --- |
| `frontend/components/ui/barcode-scanner.tsx` | Abre la cámara, usa `BarcodeDetector.detect(video)` y entrega `barcodes[0].rawValue` |
| `frontend/components/products/product-form.tsx` | Recibe el texto y hace `setBarcodeValue(code)` (línea ~561) |
| `backend/src/modules/products/products.controller.ts:134` | `GET /products/barcode/:code` |
| `backend/src/modules/products/products.service.ts:89` | `findByBarcode` busca coincidencia exacta `companyId + barcode` |

### 2.2 Limitaciones detectadas

1. **Se descarta el formato detectado.** `BarcodeDetector` devuelve `format`, pero la interfaz global solo declara `rawValue` y el componente no lo propaga. Sin formato no se puede distinguir EAN-13 de Code 128/GS1-128.
2. **No se interpreta el contenido.** El texto se guarda tal cual; no se valida GTIN, no se separan AIs, no se parsean fechas.
3. **Formatos incompletos.** La lista actual solo incluye lineal 1D (`ean_13`, `ean_8`, `code_128`, `code_39`, `upc_a`, `upc_e`, `codabar`, `itf`). Faltan `qr_code`, `data_matrix`, `pdf417`, `aztec` y `code_93`, que son los que suelen llevar fecha/lote.
4. **Búsqueda exacta.** `findByBarcode` no normaliza: un EAN-13 `7701234567897` y su GTIN-14 `07701234567897` no coinciden entre sí.
5. **No hay enriquecimiento.** Si el código no está en el catálogo, no se consulta ninguna fuente; el usuario escribe todo a mano.
6. **No hay detección de duplicados al escanear.** Se podría crear un producto con un código que ya existe en la empresa.
7. **Cobertura de navegador.** `BarcodeDetector` nativo solo existe en Chromium (Chrome/Edge/Opera/Samsung). Firefox y Safari muestran el mensaje de no disponible.

---

## 3. Qué contiene realmente cada simbología

| Simbología | Estándar | Contenido típico | ¿Nombre? | ¿Vencimiento? |
| --- | --- | --- | --- | --- |
| EAN-13 | ISO/IEC 15420 | GTIN-13 (13 dígitos) | No | No |
| EAN-8 | ISO/IEC 15420 | GTIN-8 | No | No |
| UPC-A / UPC-E | ISO/IEC 15420 | GTIN-12 comprimido | No | No |
| ITF-14 | ISO/IEC 16390 | GTIN-14 (cajas/logística) | No | No |
| Code 128 | ISO/IEC 15417 | Texto libre o GS1-128 | Solo si el emisor codificó un nombre | Solo si usa AI 17 |
| GS1-128 | GS1 General Specifications | AIs: `01`, `10`, `17`, `11`, `21`, `310n`… | No (a veces AI `240` trae una referencia, no el nombre) | **Sí** (AI `17`) |
| GS1 DataMatrix | ISO/IEC 16022 + GS1 | Igual que GS1-128, muy usado en farmacia | No | **Sí** |
| GS1 QR / QR | ISO/IEC 18004 | URL, JSON, texto o GS1 Digital Link | Depende del contenido | Depende |
| GS1 DataBar | ISO/IEC 24724 | GTIN + peso/precio variable | No | No |
| GS1 Digital Link (QR) | GS1 Digital Link | URL con AIs en path/query | No por sí solo; la página destino puede tenerlo | **Sí** si incluye `?17=` |
| HIBC | HIBC | Salud: licencia + producto + check | No | A veces |
| Código interno | Libre | SKU/prefijo propio | No | No |

> Regla práctica: **si el símbolo no es GS1 con AI de fecha, la fecha de vencimiento no está en el código**. En un EAN-13 de góndola es imposible obtenerla escaneando.

---

## 4. Método propuesto: pipeline de decodificación

### 4.1 Paso 0 — Captura

Cambiar el contrato del escáner para entregar también el formato:

```ts
// barcode-scanner.tsx
export interface ScanResult {
  rawValue: string;
  format: string; // "ean_13" | "code_128" | "qr_code" | "data_matrix" | ...
}
```

`BarcodeDetector` ya devuelve `format`; solo hay que declararlo en el tipo global y pasarlo en `onDetected`.

Formatos a solicitar (si el navegador los soporta):

```ts
const FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e", "itf",
  "code_128", "code_39", "code_93", "codabar",
  "qr_code", "data_matrix", "pdf417", "aztec",
] as const;
```

Nota: la API nativa **no tiene un formato `gs1_128`**. Un GS1-128 se detecta como `code_128`; hay que reconocerlo por el contenido (prefijo `]C1`, AI `01`, FNC1). Lo mismo aplica a GS1 DataMatrix (`data_matrix` + AI `01`).

### 4.2 Paso 1 — Normalización

```ts
function normalizeRaw(raw: string): string {
  return raw
    .replace(/^\][A-Za-z0-9]{2}/, "") // prefijo AIM: ]C1, ]Q1, ]d2...
    .replace(/\u001d/g, "|")          // FNC1/GS (ASCII 29) como separador
    .replace(/\r?\n/g, "")
    .trim();
}
```

Casos que hay que tolerar:

- Prefijo AIM (`]C1` GS1-128, `]Q1` GS1 QR, `]d2` GS1 DataMatrix).
- Separador FNC1 representado como `\u001D`, `|` o ausente.
- Lectores que entregan la forma legible `(01)09506000134352(17)261231`.
- Mayúsculas/minúsculas y espacios accidentales.

### 4.3 Paso 2 — Clasificación del contenido

```
¿Es solo dígitos de longitud 8, 12, 13 o 14?
  → GTIN simple (EAN-8, UPC-A, EAN-13, ITF-14)

¿Empieza con AI 01/02/00 o contiene "|" / "(01)"?
  → GS1 element string (GS1-128, GS1 DataMatrix, GS1 QR)

¿Es una URL con /01/<gtin> o parámetros ?17=?
  → GS1 Digital Link

¿Es JSON con claves conocidas?
  → QR propietario (solo si definimos un contrato)

Otro texto
  → Código interno / libre (guardar como barcode, sin enriquecer)
```

### 4.4 Paso 3 — Validar GTIN (fórmula del dígito verificador)

El GTIN usa **módulo 10 con pesos 3 y 1** desde la derecha (excluyendo el dígito verificador):

```ts
export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function toGtin14(value: string): string | null {
  if (!isValidGtin(value)) return null;
  return value.padStart(14, "0");
}
```

Ejemplo verificado con el caso canónico de GS1: `09520123456788`.

- Dígitos de datos: `0 9 5 2 0 1 2 3 4 5 6 7 8`
- Suma con pesos 3,1 desde la derecha: `102`
- Verificador: `(10 - (102 % 10)) % 10 = 8` → válido.

Normalización importante:

| Entrada | GTIN-14 |
| --- | --- |
| EAN-13 `7701234567897` | `07701234567897` |
| UPC-A `012345678905` | `00012345678905` |
| EAN-8 `12345670` | `00000012345670` |
| ITF-14 `17701234567894` | `17701234567894` |

Para buscar en el catálogo conviene guardar/comparar el **GTIN-14 normalizado**, no el texto crudo.

### 4.5 Paso 4 — Parsear GS1 Application Identifiers

Un GS1 element string es una concatenación de `AI + valor`. Los AI son de 2, 3 o 4 dígitos. Los campos de longitud fija no llevan separador; los variables terminan en FNC1 (`|`) o al final del texto.

Tabla mínima para retail/alimentos:

| AI | Significado | Formato | Longitud |
| --- | --- | --- | --- |
| `01` | GTIN | N14 | Fija 14 |
| `02` | GTIN de unidades contenidas | N14 | Fija 14 |
| `10` | Lote | X…20 | Variable |
| `11` | Fecha de producción | N6 (YYMMDD) | Fija 6 |
| `13` | Fecha de empaque | N6 | Fija 6 |
| `15` | Consumir preferentemente antes | N6 | Fija 6 |
| `16` | Vender antes | N6 | Fija 6 |
| `17` | Fecha de vencimiento | N6 | Fija 6 |
| `21` | Número de serie | X…20 | Variable |
| `30` | Cantidad variable | N…8 | Variable |
| `310n`–`316n` | Peso neto (kg, lb, etc.) | N6 | Fija 6 |
| `320n`–`337n` | Medidas de peso/volumen | N6 | Fija 6 |
| `390n`–`395n` | Importe/precio | N…15 | Variable |
| `422` | País de origen | N3 | Fija 3 |
| `7003` | Fecha y hora de vencimiento | N10 (YYMMDDHHMM) | Fija 10 |
| `8005` | Precio por unidad de medida | N6 | Fija 6 |
| `90`–`99` | Uso interno del emisor | X…30 | Variable |

Pseudocódigo del parser:

```ts
type AiSpec = { fixed?: number; max?: number };

const AI_SPECS: Record<string, AiSpec> = {
  "00": { fixed: 18 },
  "01": { fixed: 14 },
  "02": { fixed: 14 },
  "10": { max: 20 },
  "11": { fixed: 6 },
  "13": { fixed: 6 },
  "15": { fixed: 6 },
  "16": { fixed: 6 },
  "17": { fixed: 6 },
  "21": { max: 20 },
  "30": { max: 8 },
  "310": { fixed: 6 }, // el 4.º dígito indica decimales
  "320": { fixed: 6 },
  "392": { max: 15 },
  "422": { fixed: 3 },
  "7003": { fixed: 10 },
  "8005": { fixed: 6 },
};

function matchAi(text: string, at: number): string | null {
  for (const size of [4, 3, 2]) {
    const candidate = text.slice(at, at + size);
    if (candidate.length === size && AI_SPECS[candidate]) return candidate;
    // Para familias 310n..316n, 320n..337n, 390n..395n:
    const family = candidate.slice(0, 3);
    if (size === 4 && AI_SPECS[family]) return candidate;
  }
  return null;
}

export function parseGs1(raw: string): Record<string, string> {
  const text = normalizeRaw(raw);
  const out: Record<string, string> = {};
  let i = 0;

  while (i < text.length) {
    if (text[i] === "|") { i++; continue; }

    const ai = matchAi(text, i);
    if (!ai) throw new Error(`AI desconocido en posición ${i}`);

    i += ai.length;
    const spec = AI_SPECS[ai] ?? AI_SPECS[ai.slice(0, 3)];
    if (!spec) throw new Error(`AI no soportado: ${ai}`);

    if (spec.fixed) {
      const value = text.slice(i, i + spec.fixed);
      if (value.length !== spec.fixed) throw new Error(`AI ${ai} truncado`);
      out[ai] = value;
      i += spec.fixed;
    } else {
      const end = text.indexOf("|", i);
      const value = text.slice(i, end === -1 ? undefined : end);
      if (!value || (spec.max && value.length > spec.max)) {
        throw new Error(`AI ${ai} con longitud inválida`);
      }
      out[ai] = value;
      i = end === -1 ? text.length : end;
    }
  }
  return out;
}
```

Advertencias de parseo:

- Si un campo variable no lleva FNC1 y le sigue otro AI, el parser no puede saber dónde termina; hay que validar el resultado y, si hay ambigüedad, no autocompletar.
- Los AI de fecha **deben** ir acompañados de `01` o `02` según GS1; si no, se descarta.
- No confiar en el nombre de un AI `240` (identificación adicional del fabricante): es una referencia, no el nombre comercial.

### 4.6 Paso 5 — Fechas GS1 (YYMMDD)

Fórmula:

- `YY` → año `2000 + YY` (ventana 2000–2099, suficiente para alimentos).
- `MM` → 01–12.
- `DD` → 01–último día del mes; **`00` significa el último día del mes** (permitido por GS1).
- Validar contra calendario real (años bisiestos).

```ts
function parseGs1Date(value: string): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const effectiveDay = day === 0 ? lastDay : day;
  if (effectiveDay < 1 || effectiveDay > lastDay) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(effectiveDay)}`;
}
```

Ejemplos:

| AI | Valor | Resultado |
| --- | --- | --- |
| `17` | `261231` | 2026-12-31 |
| `17` | `270200` | 2027-02-28 (último día de febrero) |
| `17` | `280200` | 2028-02-29 (bisiesto) |
| `17` | `261332` | inválido (mes 13) |

Para AI `7003` (`YYMMDDHHMM`), los primeros 6 dígitos se parsean igual y los 4 restantes son hora/minuto.

### 4.7 Paso 6 — Medidas y precios con decimales implícitos

El cuarto dígito de `310n`, `392n`, etc. indica la posición decimal:

```ts
function parseMeasure(ai: string, raw: string): number {
  const decimals = Number(ai[3]);
  return Number(raw) / 10 ** decimals;
}

// (3103)000195 → 0.195 kg
// (3922)0299   → 2.99 (unidades monetarias)
```

No usar estos valores para fijar el precio de venta sin confirmación: son datos del empaque, no del negocio.

### 4.8 Paso 7 — GS1 Digital Link (QR)

Un QR moderno suele ser una URL:

```
https://id.gs1.org/01/09520123456788/10/ABC1/21/12345?17=180426
```

Equivale a:

```
(01)09520123456788(17)180426(10)ABC1(21)12345
```

Parseo:

1. Validar que sea `https`.
2. Recorrer segmentos del path en pares `AI/valor` (puede haber prefijos de marca antes del `01`).
3. Leer parámetros de query cuyo nombre sea un AI (`17`, `3103`, etc.).
4. Normalizar el GTIN a 14 dígitos.
5. **No hacer fetch de la URL** desde el cliente ni desde el backend sin allowlist: un QR puede apuntar a cualquier sitio (riesgo SSRF/phishing).

```ts
export function parseDigitalLink(raw: string): Record<string, string> {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Enlace no seguro");

  const data: Record<string, string> = {};
  const segments = url.pathname.split("/").filter(Boolean);

  for (let i = 0; i + 1 < segments.length; i += 2) {
    const ai = segments[i];
    if (/^\d{2,4}$/.test(ai)) data[ai] = decodeURIComponent(segments[i + 1]);
  }
  for (const [key, value] of url.searchParams) {
    if (/^\d{2,4}$/.test(key)) data[key] = value;
  }
  return data;
}
```

### 4.9 QR/JSON propietario

Solo si el negocio controla la etiqueta. Contrato sugerido:

```json
{
  "type": "ventas.product",
  "gtin": "07701234567897",
  "name": "Atún en aceite 170 g",
  "brand": "Marca",
  "expiry": "2027-05-31",
  "lot": "L-2026-10",
  "weightKg": 0.17
}
```

Validar con Zod y límites de tamaño; nunca ejecutar ni interpretar HTML.

---

## 5. De código a datos de producto: resolución y enriquecimiento

### 5.1 Orden de resolución

```
1. Catálogo propio (misma empresa)
   ├─ barcode exacto
   ├─ GTIN-14 normalizado
   └─ barcode de presentación
   → Si existe: ofrecer "ya existe", no crear duplicado.

2. Caché de enriquecimiento (BD)
   → Si hay datos vigentes, usarlos.

3. Proveedor externo (solo servidor)
   → Open Food Facts, UPCitemdb o Verified by GS1 según cobertura.
   → Guardar en caché con TTL.

4. Sin datos
   → Precargar solo el GTIN/código y pedir nombre/vencimiento al usuario.
```

### 5.2 Qué puede devolver cada fuente externa

| Fuente | Cobertura | Datos útiles | Límites |
| --- | --- | --- | --- |
| Open Food Facts (`/api/v2/product/{gtin}.json`) | Alimentos, global | `product_name`, `brands`, `quantity`, `image_url`, categorías | Cobertura irregular en Perú; política de uso y rate limit |
| UPCitemdb | Global, no solo alimentos | Título, marca, imagen | API de prueba con cuota |
| Verified by GS1 | Registro oficial GS1 | Marca, descripción, imagen, contenido neto, mercado | Requiere acceso/credenciales GS1 |
| Catálogo del proveedor/distribuidor | El más fiable para el negocio | Nombre, costo, presentación, lote, vencimiento | Requiere integración propia |

Ninguna fuente externa debe aportar **precio de venta, stock, mínimo o perfil de vigencia**. Esos son datos del negocio.

### 5.3 Normalización en base de datos

Recomendación:

- Mantener `Product.barcode` como el código escaneado (compatibilidad).
- Añadir `Product.gtin String?` con el GTIN-14 normalizado e índice `@@index([companyId, gtin])` (evaluar unicidad por empresa).
- Al guardar, si el código es un GTIN válido, calcular `gtin`; si es un código interno, dejar `gtin = null`.
- `ProductBatch.batchNumber` ya existe: usarlo con AI `10`.
- `ProductBatch.expirationDate` ya existe: usarlo con AI `17`.
- `Product.expiryProfile` ya existe: el código no lo determina; se sugiere según categoría y lo confirma el usuario.

### 5.4 Contrato de respuesta sugerido para el frontend

```ts
interface BarcodeResolution {
  raw: string;
  format: string;
  kind: "GTIN" | "GS1" | "DIGITAL_LINK" | "JSON" | "INTERNAL" | "UNKNOWN";
  gtin?: string;        // GTIN-14 normalizado
  lot?: string;
  expiry?: string;      // YYYY-MM-DD
  productionDate?: string;
  serial?: string;
  netWeightKg?: number;
  price?: number;
  product?: {
    id: string;
    name: string;
    brand?: string;
    imageUrl?: string;
    quantity?: string;
  };
  source: "catalog" | "cache" | "openfoodfacts" | "upcitemdb" | "gs1" | "none";
  confidence: "high" | "medium" | "low";
  warnings: string[];
}
```

---

## 6. Arquitectura propuesta en este proyecto

### 6.1 Frontend

```
frontend/lib/barcode/
├── normalize.ts        // FNC1, prefijos AIM, paréntesis
├── gtin.ts             // validación, normalización a GTIN-14
├── gs1.ts              // tabla de AIs, parser, fechas, medidas
├── digital-link.ts     // parseo de URL GS1
├── classify.ts         // decide el tipo de contenido
├── resolve.ts          // orquesta parseo + llamada al backend
└── *.test.ts           // vectores GS1 reales y casos límite
```

Cambios en componentes:

- `barcode-scanner.tsx`: entregar `{ rawValue, format }`, añadir formatos 2D.
- `product-form.tsx`: al detectar, ejecutar `resolveBarcode()`; mostrar un panel "Datos detectados" con GTIN, lote, vencimiento y fuente; aplicar solo a campos vacíos; permitir editar/descartar.
- Si el catálogo devuelve un producto existente: mostrar enlace y bloquear el alta duplicada.

### 6.2 Backend

```
backend/src/modules/products/
├── barcode.controller.ts        // GET /products/barcode/:code (existente)
├── barcode-resolution.service.ts // normaliza, busca catálogo y caché
├── barcode-providers/            // adaptadores externos (opcional)
└── dto/barcode.dto.ts
```

Recomendaciones:

- `GET /products/barcode/:code` debe aceptar EAN-13, UPC-A, GTIN-14 y códigos internos; normalizar antes de consultar.
- Añadir `GET /products/barcode/:code/resolve` (o `?enrich=true`) para enriquecimiento con timeout corto (2 s) y caché.
- El enriquecimiento externo va en el **servidor** para no exponer claves, controlar rate limits y cachear.
- Feature flag por empresa/plan para evitar latencia y dependencia externa.
- Si el proveedor falla, la respuesta debe ser exitosa con `source: "none"` y el formulario sigue funcionando.

### 6.3 Caché opcional

```prisma
model BarcodeLookupCache {
  id         String   @id @default(cuid())
  gtin       String
  provider   String
  payload    Json
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime
  @@unique([gtin, provider])
  @@index([expiresAt])
}
```

TTL sugerido: 30–90 días para datos positivos, 7 días para negativos (no encontrado).

---

## 7. Reglas de negocio y UX

1. **Nunca autocompletar sin confirmación.** Mostrar "Sugerencia de Open Food Facts" y un botón "Usar estos datos".
2. **No sobrescribir campos ya escritos** por el usuario; solo rellenar vacíos.
3. **No crear duplicados.** Si el GTIN ya existe en la empresa, ofrecer abrir/editar el producto existente.
4. **Separar fecha general de fecha por lote.** Si el GS1 trae lote + vencimiento, sugerir crear un lote; si no hay lote, usar la fecha general del producto.
5. **El perfil de vigencia no se deduce del código.** Si hay fecha, el usuario elige perfil (perecedero/estándar/larga duración/personalizado) o se mantiene el actual.
6. **Mostrar la fuente y la confianza.** El usuario debe saber si el nombre vino de su catálogo, de un proveedor externo o de un QR propietario.
7. **Fallback manual siempre visible.** Si la cámara o el parseo fallan, el campo de texto sigue operativo.
8. **Mensajes claros:** "El código es válido, pero no contiene fecha de vencimiento" en lugar de dejar el campo vacío sin explicación.

---

## 8. Seguridad y calidad

- Validar longitud máxima del `rawValue` (p. ej. 2048) antes de procesar.
- Rechazar caracteres de control salvo FNC1; escapar cualquier texto antes de mostrarlo.
- Validar dígito verificador; no aceptar GTIN inválidos como identificador global.
- No hacer `fetch` de URLs contenidas en QR sin allowlist y sin timeout; idealmente no hacerlo en absoluto.
- Enriquecimiento externo: timeout, reintentos limitados, circuit breaker, rate limit y caché.
- Privacidad: los frames de cámara no salen del dispositivo; solo se envía el texto del código.
- Evitar registrar códigos completos en logs si se consideran datos sensibles; registrar como máximo el GTIN enmascarado.
- Accesibilidad: alternativa de entrada manual y mensajes de error legibles.

---

## 9. Pruebas recomendadas

### 9.1 Unitarias (parser puro)

| Caso | Entrada | Esperado |
| --- | --- | --- |
| GTIN canónico | `09520123456788` | válido, GTIN-14 igual |
| EAN-13 | `7701234567897` | GTIN-14 `07701234567897` |
| Dígito verificador inválido | `09520123456780` | inválido |
| GS1-128 con lote y fecha | `01095201234567881718042610ABC1` | `01`, `17=2018-04-26`, `10=ABC1` |
| GS1 con FNC1 | `...10ABC1\u001D17261231` | separación correcta |
| Fecha fin de mes | `17=270200` | 2027-02-28 |
| Año bisiesto | `17=280200` | 2028-02-29 |
| Fecha inválida | `17=261332` | rechazo |
| Peso | `3103=000195` | 0.195 kg |
| Digital Link | `https://id.gs1.org/01/09520123456788/10/ABC1?17=261231` | GTIN, lote y fecha |
| QR no seguro | `http://...` | rechazo |
| Código interno | `INT-00123` | tipo `INTERNAL`, sin enriquecimiento |
| Texto largo | 5000 caracteres | rechazo por límite |

### 9.2 Integración

- Escanear un producto existente → no permitir duplicado y ofrecer abrirlo.
- Escanear un GS1 con fecha → fecha y lote precargados, perfil sin cambios.
- Proveedor externo caído → el formulario sigue operativo.
- Respuesta externa con nombre vacío → no sobrescribir.

### 9.3 Navegador

- El formulario abre con cámara disponible y sin errores de consola.
- El panel de datos detectados muestra la fuente.
- Cancelar el escaneo no altera el formulario.
- La suite actual de compras sigue pasando.

---

## 10. Limitaciones y expectativas

1. **EAN-13 no trae nombre ni vencimiento.** Cualquier promesa de "leer el nombre del código" en góndola es incorrecta salvo consulta a base de datos.
2. **Cobertura externa limitada en Perú.** Muchos productos locales no están en Open Food Facts; el catálogo propio y los datos del proveedor son la fuente principal.
3. **GS1-128/DataMatrix no es lo habitual en retail de consumo.** Es común en farmacia, logística y algunos alimentos; en góndola predomina EAN-13.
4. **La API nativa no existe en Safari/Firefox.** Para cobertura total haría falta un polyfill (`@zxing/browser`, `barcode-detector` WASM) con costo de bundle y rendimiento.
5. **Render gratuito puede dormir.** El enriquecimiento externo debe tener timeout y no bloquear el alta si el backend tarda.
6. **El código puede estar dañado o pertenecer a otro país.** Validar y avisar, no bloquear el flujo manual.

---

## 11. Plan por fases (propuesta)

| Fase | Entregable | Dependencias | Estimación | Estado |
| --- | --- | --- | --- | --- |
| 1 | Parser puro (GTIN, GS1, fechas, Digital Link) + pruebas + `format` en el escáner | Ninguna | 2–3 días | Implementada |
| 2 | Precarga en el formulario: GTIN, lote, vencimiento, aviso de duplicado; búsqueda normalizada en catálogo | Fase 1 | 1–2 días | Implementada |
| 3 | Enriquecimiento externo en backend con caché, timeout y feature flag | Fase 2 | 3–5 días | Pendiente |
| 4 | Uso de lote/vencimiento GS1 en `ProductBatch` y perfiles de vigencia | Fase 2 | 2–3 días | Pendiente |
| 5 | Polyfill cross-browser, galería y flash | Fase 1 | 2–4 días | Pendiente |

Implementación actual: parser y pruebas en `frontend/lib/barcode/`; búsqueda normalizada en `backend/src/common/helpers/barcode.helper.ts` y `backend/src/modules/products/products.service.ts`; panel de datos detectados y aviso de duplicado en `frontend/components/products/product-form.tsx`; `format` del detector en `frontend/components/ui/barcode-scanner.tsx`.

Recomendación: implementar **Fases 1 y 2 primero**. Aportan valor inmediato (validación, no duplicados, lote/fecha cuando existan) sin depender de terceros. La Fase 3 solo si se valida cobertura real con una muestra de códigos del negocio.

---

## 12. Referencias

- GS1 General Specifications (AIs, fechas, FNC1): https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications
- GS1 Application Identifiers: https://www.gs1.org/standards/barcodes/application-identifiers
- GS1 Digital Link URI Syntax: https://ref.gs1.org/standards/digital-link/uri-syntax/
- GS1 DataMatrix Guideline: https://www.gs1.org/docs/barcodes/GS1_DataMatrix_Guideline.pdf
- MDN Barcode Detection API: https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
- Chrome Shape Detection API: https://developer.chrome.com/docs/capabilities/shape-detection
- Open Food Facts API: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Documentos internos: `docs/barcode-scanner-plan.md`, `docs/guia-lector-scanner.md`
