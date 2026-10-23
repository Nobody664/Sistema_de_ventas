# Plan: Escáner de Código de Barras

## Objetivo

Agregar escáner de código de barras vía cámara en el formulario de nuevo/editar producto, permitiendo al usuario capturar el código sin escribirlo manualmente.

---

## Implementación

### API utilizada: `BarcodeDetector`

Se eligió la **API nativa `BarcodeDetector`** (Chromium 81+) por:

- **Sin dependencias externas** — no requiere instalar librerías
- **Detección rápida** — acelerada por hardware, procesa frames en tiempo real
- **Soporte multiformato** — EAN-13, EAN-8, Code 128, Code 39, UPC-A, UPC-E, Codabar, ITF

**Limitación:** Solo disponible en navegadores basados en Chromium (Chrome, Edge, Opera, Samsung Internet). No funciona en Firefox ni Safari. Como fallback se muestra un mensaje informativo.

### Componentes creados

| Archivo | Propósito |
|---------|-----------|
| `frontend/components/ui/barcode-scanner.tsx` | Componente de escáner con cámara y viewfinder |
| `frontend/components/products/product-form.tsx` | Integración en el formulario de producto |

### Flujo de uso

1. Usuario hace clic en el botón **cámara** junto al campo "Código de barras"
2. Se abre un modal **fullscreen** con la cámara trasera activada
3. Un viewfinder (recuadro verde) indica dónde alinear el código
4. Al detectar un código, el modal se cierra y el valor se escribe automáticamente
5. Si no hay detección, el usuario puede cancelar con el botón ✕

### UX decisions

- **Modal fullscreen negro** — aísla al usuario en la tarea de escaneo, evitando distracciones
- **Animación pulse en línea de escaneo** — guía visual para alinear el código
- **Overlay semitransparente** — el área fuera del viewfinder se oscurece para enfocar la atención
- **Detección continua** — usa `requestAnimationFrame` para procesar frames sin bloqueo
- **Auto-stop al detectar** — la cámara se apaga inmediatamente al encontrar un código

### Estructura del componente `BarcodeScanner`

```
┌─────────────────────────────────────┐
│  Header: "Escanea el código..."  ✕ │
├─────────────────────────────────────┤
│                                     │
│        ┌─────────────────┐          │
│        │                 │          │
│        │   ██▓▒░░▓██     │          │  ← viewfinder verde
│        │   ─────────     │          │  ← línea pulsante
│        │                 │          │
│        └─────────────────┘          │
│                                     │
├─────────────────────────────────────┤
│  "Alinea el código dentro..."       │
└─────────────────────────────────────┘
```

### Formatos soportados

| Formato | Uso común |
|---------|-----------|
| EAN-13 | Productos de consumo (estándar) |
| EAN-8 | Productos pequeños |
| Code 128 | Logística, inventario |
| Code 39 | Industria, automotriz |
| UPC-A | Estados Unidos y Canadá |
| UPC-E | Versión compacta de UPC-A |
| Codabar | Librerías, bancos de sangre |
| ITF | Empaques, distribución |

---

## Verificación

### Requisitos para funcionar

1. **Navegador compatible**: Chrome 81+, Edge 81+, Opera 68+
2. **Conexión segura**: HTTPS o localhost (requisito de `getUserMedia`)
3. **Permiso de cámara**: El navegador solicitará permiso al abrir el escáner

### Prueba manual

1. Ir a `Productos → Nuevo producto`
2. Hacer clic en el botón 📷 junto al campo "Código de barras"
3. Permitir acceso a la cámara
4. Enfocar un código de barras físico
5. Verificar que el valor se escribe automáticamente

### Fallbacks

- `BarcodeDetector` no soportado → muestra mensaje en texto ámbar
- Cámara no disponible (denegada/inexistente) → muestra error en el modal
- Sin detección → el usuario cancela manualmente

---

## Mejoras futuras (no implementadas)

- [ ] **Escáner manual**: modo táctil para escribir el código si la cámara no funciona
- [ ] **Flash LED**: opción para encender el flash con poca luz
- [ ] **Galería**: escanear desde una foto existente
- [ ] **Feedback háptico**: vibración al detectar (vibration API)
- [ ] **Sonido**: beep al detectar (Web Audio API)
