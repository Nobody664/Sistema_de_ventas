const assert = require("node:assert/strict");
const bwip = require("bwip-js");

const GTIN = "09520123456788";

async function fixture(bcid, text) {
  return {
    name: `${bcid}.png`,
    mimeType: "image/png",
    buffer: await bwip.toBuffer({
      bcid,
      text,
      scale: 3,
      height: 25,
      padding: 12,
      backgroundcolor: "FFFFFF",
    }),
  };
}

async function runScannerChecks(page, origin, { galleryOnly = false } = {}) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    window.__scanner = {
      calls: 0,
      stops: 0,
      constraints: [],
      failTorch: false,
      hit: false,
      defer: false,
      blobs: [],
    };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (file) => {
      const url = create(file);
      window.__scanner.blobs.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      window.__scanner.blobs = window.__scanner.blobs.filter(
        (value) => value !== url,
      );
      revoke(url);
    };
  });

  const fresh = () =>
    page.goto(`${origin}/products/new`, { waitUntil: "domcontentloaded" });
  const open = async () => {
    await page
      .getByRole("button", { name: "Escanear código de barras", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
  };
  const upload = async (file) =>
    page
      .getByLabel("Imagen con código de barras", { exact: true })
      .setInputFiles(file);
  const closed = () => page.getByRole("dialog").waitFor({ state: "hidden" });
  const qr = await fixture(
    "qrcode",
    `https://id.gs1.org/01/${GTIN}/10/QR-LOT?17=271231`,
  );

  for (const sample of [
    {
      image: await fixture("ean13", "7701234567897"),
      barcode: "7701234567897",
      label: "EAN-13",
    },
    {
      image: await fixture("gs1-128", `(01)${GTIN}(17)271231(10)LOT-128`),
      barcode: GTIN,
      label: "Code 128",
      lot: "LOT-128",
    },
    { image: qr, barcode: GTIN, label: "QR", lot: "QR-LOT" },
    {
      image: await fixture("gs1datamatrix", `(01)${GTIN}(17)271231(10)LOT-DM`),
      barcode: GTIN,
      label: "DataMatrix",
      lot: "LOT-DM",
    },
    {
      image: await fixture("azteccode", `(01)${GTIN}(17)271231(10)LOT-AZ`),
      barcode: GTIN,
      label: "Aztec",
      lot: "LOT-AZ",
    },
  ]) {
    await fresh();
    await open();
    await upload(sample.image);
    await closed();
    assert.equal(await page.locator("#barcode").inputValue(), sample.barcode);
    await page.getByText(sample.label, { exact: true }).waitFor();
    if (sample.lot) {
      assert.equal(
        await page.locator("#initialBatchNumber").inputValue(),
        sample.lot,
      );
      assert.equal(
        await page.locator("#expiryDate").inputValue(),
        "2027-12-31",
      );
    }
    assert.equal(await page.evaluate(() => window.__scanner.blobs.length), 0);
  }
  console.log(
    "PASS: imágenes EAN-13, GS1-128 con FNC1, QR Digital Link, GS1 DataMatrix y Aztec sin BarcodeDetector nativo",
  );

  for (const scenario of [
    "partial",
    "formats-error",
    "constructor-error",
    "detect-error",
  ]) {
    await fresh();
    await page.evaluate((scenario) => {
      window.BarcodeDetector = class {
        static async getSupportedFormats() {
          if (scenario === "formats-error") throw new Error("unsupported");
          return ["ean_13"];
        }
        constructor() {
          if (scenario === "constructor-error") throw new Error("failed");
        }
        async detect() {
          if (scenario === "detect-error") throw new Error("failed");
          return [];
        }
      };
    }, scenario);
    await open();
    await upload(qr);
    await closed();
    assert.equal(await page.locator("#barcode").inputValue(), GTIN);
  }
  console.log(
    "PASS: fallback ante soporte nativo parcial y errores al inicializar o detectar",
  );

  await fresh();
  await open();
  await upload({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Elige una imagen" })
    .waitFor();
  await upload({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await page.getByRole("alert").filter({ hasText: "10 MB" }).waitFor();
  await upload({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("broken png"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "No se pudo abrir" })
    .waitFor();
  const white = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    canvas.getContext("2d").fillStyle = "white";
    canvas.getContext("2d").fillRect(0, 0, 100, 100);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await upload({
    name: "empty.png",
    mimeType: "image/png",
    buffer: Buffer.from(white, "base64"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "No se encontró un código" })
    .waitFor();
  assert.equal(await page.evaluate(() => window.__scanner.blobs.length), 0);
  await upload(qr);
  await closed();
  console.log(
    "PASS: archivos inválidos, corruptos, sin código y mayores a 10 MB permiten reintentar sin filtrar URLs blob",
  );

  if (galleryOnly) return;

  const camera = async ({
    torch = true,
    denied = false,
    deferred = false,
    fallback = false,
  } = {}) => {
    await fresh();
    await page.evaluate(
      ({ torch, denied, deferred, fallback, qrImage }) => {
        const state = window.__scanner;
        window.BarcodeDetector = class {
          static async getSupportedFormats() {
            return ["ean_13"];
          }
          async detect() {
            state.calls++;
            return state.hit
              ? [{ rawValue: "7701234567897", format: "ean_13" }]
              : [];
          }
        };
        if (fallback) window.BarcodeDetector = undefined;
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            state.requests = (state.requests || 0) + 1;
            if (denied) throw new DOMException("denied", "NotAllowedError");
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            canvas.getContext("2d").fillRect(0, 0, 640, 480);
            if (fallback) {
              const image = new Image();
              await new Promise((resolve) => {
                image.onload = resolve;
                image.src = `data:image/png;base64,${qrImage}`;
              });
              const context = canvas.getContext("2d");
              context.fillStyle = "white";
              context.fillRect(0, 0, 640, 480);
              context.drawImage(image, 140, 60, 360, 360);
            }
            const stream = canvas.captureStream(10);
            const track = stream.getVideoTracks()[0];
            const stop = track.stop.bind(track);
            track.stop = () => {
              state.stops++;
              stop();
            };
            track.getCapabilities = () => ({ torch });
            track.applyConstraints = async (constraints) => {
              state.constraints.push(constraints);
              if (state.failTorch) throw new Error("torch unavailable");
            };
            state.stream = stream;
            state.track = track;
            if (deferred)
              await new Promise((resolve) => {
                state.grant = resolve;
              });
            return stream;
          },
        });
      },
      {
        torch,
        denied,
        deferred,
        fallback,
        qrImage: qr.buffer.toString("base64"),
      },
    );
    await open();
    await page
      .getByRole("button", { name: "Activar cámara", exact: true })
      .click();
    if (fallback) await closed();
    else if (!denied && !deferred)
      await page
        .getByRole("button", { name: "Detener cámara", exact: true })
        .waitFor();
  };

  await camera();
  await page
    .getByRole("button", { name: "Encender flash", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apagar flash", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => window.__scanner.constraints[0].advanced[0].torch,
    ),
    true,
  );
  await page.evaluate(() => {
    window.__scanner.failTorch = true;
  });
  await page.getByRole("button", { name: "Apagar flash", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "No se pudo cambiar el flash" })
    .waitFor();
  assert.equal(await page.evaluate(() => window.__scanner.stops), 0);
  let resolved = 0;
  const count = (request) => {
    if (request.url().includes("/products/barcode/7701234567897/resolve"))
      resolved++;
  };
  page.on("request", count);
  await page.evaluate(() => {
    window.__scanner.hit = true;
  });
  await closed();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  assert.equal(await page.locator("#barcode").inputValue(), "7701234567897");
  assert.equal(resolved, 1);
  page.off("request", count);
  console.log(
    "PASS: cámara nativa, flash condicional, fallo de flash recuperable y entrega única con cámara detenida",
  );

  await camera({ torch: false });
  assert.equal(
    await page
      .getByRole("button", { name: "Encender flash", exact: true })
      .count(),
    0,
  );
  await page.keyboard.press("Escape");
  await closed();
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  await camera();
  await upload(qr);
  await closed();
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  assert.equal(await page.locator("#barcode").inputValue(), GTIN);
  await camera({ denied: true });
  await page
    .getByRole("alert")
    .filter({ hasText: "No se autorizó la cámara" })
    .waitFor();
  await upload(qr);
  await closed();
  console.log(
    "PASS: sin flash, Escape, cambio a galería y permisos denegados liberan recursos y mantienen disponible la lectura",
  );

  await camera({ deferred: true });
  await page.waitForFunction(
    () => typeof window.__scanner.grant === "function",
  );
  await page.keyboard.press("Escape");
  await closed();
  await page.evaluate(() => window.__scanner.grant());
  await page.waitForFunction(() => window.__scanner.stops === 1);
  assert.equal(await page.locator("#barcode").inputValue(), "");
  await camera();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "La cámara se pausó" })
    .waitFor();
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  await page.keyboard.press("Escape");
  await closed();
  console.log(
    "PASS: permisos tardíos tras cerrar y pestaña oculta no dejan cámaras activas ni resultados obsoletos",
  );

  await camera({ fallback: true });
  assert.equal(await page.locator("#barcode").inputValue(), GTIN);
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  await fresh();
  await page.evaluate(() => {
    window.BarcodeDetector = class {
      static async getSupportedFormats() {
        return ["qr_code"];
      }
      async detect() {
        return new Promise((resolve) => {
          window.__scanner.finishImage = () =>
            resolve([{ rawValue: "7701234567897", format: "ean_13" }]);
        });
      }
    };
  });
  await open();
  await upload(qr);
  await page.waitForFunction(
    () => typeof window.__scanner.finishImage === "function",
  );
  await page.keyboard.press("Escape");
  await closed();
  await page.evaluate(() => window.__scanner.finishImage());
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#barcode").inputValue(), "");
  await camera();
  await page.evaluate(() =>
    document.querySelector('a[href="/products"]').click(),
  );
  await page.waitForURL(`${origin}/products`);
  assert.equal(await page.evaluate(() => window.__scanner.stops), 1);
  console.log(
    "PASS: cámara con fallback real, cierre durante lectura de imagen y navegación no entregan resultados tardíos ni dejan streams abiertos",
  );

  await fresh();
  await open();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await closed();
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(
    "PASS: diálogo accesible, cierre por teclado y presentación móvil sin desbordamiento",
  );
}

module.exports = { runScannerChecks };
