const assert = require("node:assert/strict");
const bwip = require("bwip-js");
const path = require("node:path");

const methods = {
  payment: [
    {
      id: "pay",
      code: "YAPE",
      label: "Yape del negocio",
      instructions: "Paga a la cuenta del negocio",
      enabled: true,
    },
    {
      id: "cash",
      code: "CASH_ON_PICKUP",
      label: "Efectivo al retirar",
      instructions: "Paga en caja",
      enabled: true,
    },
    {
      id: "disabled-pay",
      code: "PLIN",
      label: "Pago deshabilitado",
      instructions: "No disponible",
      enabled: false,
    },
  ],
  shipping: [
    {
      id: "pickup",
      kind: "PICKUP",
      label: "Retiro en local",
      fee: "0",
      pickupAddress: "Av. Comercio 123",
      districts: [],
      enabled: true,
    },
    {
      id: "delivery",
      kind: "DELIVERY",
      label: "Entrega del negocio",
      fee: "5.00",
      districts: ["150101"],
      pickupAddress: "",
      enabled: true,
    },
    {
      id: "disabled-delivery",
      kind: "DELIVERY",
      label: "Entrega deshabilitada",
      fee: "8.00",
      districts: ["150102"],
      pickupAddress: "",
      enabled: false,
    },
  ],
};
const product = {
  id: "coffee",
  name: "Café de la casa",
  description: "Una selección de origen para tu día.",
  imageUrl: null,
  price: "11.80",
  currency: "PEN",
  availability: "AVAILABLE",
  baseUnit: "UNIT",
  presentations: [],
};
let authenticated = false;
let registrationRequests = 0;
let profile = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.test",
  phone: "",
  documentValue: "",
  addresses: [],
};
let cart = { version: 1, items: [] };
let quoteShipping = methods.shipping[0];
let order = null;
const settings = {
  slug: "negocio-demo",
  title: "Almacén de origen",
  description: "Productos seleccionados cerca de ti",
  enabled: true,
  registrationEnabled: true,
  checkoutEnabled: true,
  taxRate: "18",
  pricesIncludeTax: true,
  reservationMinutes: 30,
};
const denied = () => {
  const error = new Error("Inicia sesión comercial");
  error.status = 401;
  throw error;
};
const snapshot = () => ({
  currency: "PEN",
  buyer: {
    firstName: profile.firstName,
    lastName: profile.lastName,
    documentValue: profile.documentValue,
    phone: profile.phone,
  },
  payment: methods.payment[0],
  shipping: quoteShipping,
  address: null,
  lines: cart.items.map((line) => ({
    productId: line.productId,
    name: line.name,
    quantity: line.quantity,
    totalPrice: (Number(line.quantity) * 10).toFixed(2),
  })),
  subtotal: "20.00",
  taxAmount: "3.60",
  shippingAmount: "0.00",
  totalAmount: "23.60",
});

function handleStore(resource, params, method, body) {
  const path = resource.replace(/^\/store\/[^/]+\//, "");
  if (path === "info")
    return {
      name: settings.title,
      description: settings.description,
      currency: "PEN",
      checkoutEnabled: true,
    };
  if (path === "auth/register") {
    registrationRequests++;
    assert.equal("passwordConfirmation" in body, false);
    assert.deepEqual(Object.keys(body).sort(), [
      "acceptTerms",
      "email",
      "firstName",
      "lastName",
      "password",
    ]);
    return { message: "Revisa tu correo para completar la verificación" };
  }
  if (path === "auth/verify")
    return { message: "Revisa tu correo para completar la verificación" };
  if (path === "auth/login") {
    authenticated = true;
    return { role: "USUARIO_CLIENTE_FINAL" };
  }
  if (path === "auth/logout") {
    authenticated = false;
    return {};
  }
  if (!authenticated) return denied();
  if (path === "me") {
    if (method === "PATCH") Object.assign(profile, body);
    return profile;
  }
  if (path === "me/addresses" && method === "POST") {
    profile.addresses.push({ ...body, id: "address" });
    return profile;
  }
  if (path === "categories") return [{ id: "category", name: "Café" }];
  if (path === "catalog") return { data: [product], totalPages: 1, total: 1 };
  if (path === "catalog/coffee") return product;
  if (path === "methods") return methods;
  if (path === "cart") return cart;
  if (path === "cart/items") {
    assert.equal(body.version, cart.version);
    assert.equal("unitPrice" in body, false);
    cart = {
      version: cart.version + 1,
      items:
        body.quantity > 0
          ? [
              {
                productId: product.id,
                presentationId: null,
                name: product.name,
                imageUrl: product.imageUrl,
                baseUnit: product.baseUnit,
                presentationName: null,
                unitPrice: product.price,
                quantity: String(body.quantity),
                unavailable: false,
              },
            ]
          : [],
    };
    return cart;
  }
  if (path === "checkout/quote") {
    assert.equal(body.paymentMethodId, "pay");
    assert.ok(["pickup", "delivery"].includes(body.shippingMethodId));
    if (body.shippingMethodId === "delivery")
      assert.equal(body.addressId, "address");
    else assert.equal("addressId" in body, false);
    quoteShipping = methods.shipping.find(
      (method) => method.id === body.shippingMethodId,
    );
    return {
      id: "quote",
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      snapshot: snapshot(),
    };
  }
  if (path === "orders" && method === "POST") {
    assert.deepEqual(Object.keys(body).sort(), ["idempotencyKey", "quoteId"]);
    assert.ok(body.idempotencyKey.length >= 16);
    if (!order)
      order = {
        id: "order",
        number: "WEB-TEST-001",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        fulfillment: "UNFULFILLED",
        totalAmount: "23.60",
        snapshot: snapshot(),
        version: 1,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        createdAt: new Date().toISOString(),
        history: [
          {
            version: 1,
            message: "Pedido recibido",
            createdAt: new Date().toISOString(),
          },
        ],
        proofs: [],
      };
    return order;
  }
  if (path === "orders") return order ? [order] : [];
  if (path === "orders/order") return order;
  if (path === "orders/order/payment-proofs") {
    assert.ok(body.image.startsWith("data:image/"));
    order.paymentStatus = "UNDER_REVIEW";
    order.version++;
    order.proofs.push({ id: "proof", createdAt: new Date().toISOString() });
    return order;
  }
  if (path === "me/notifications") return [];
  throw new Error(`Ruta comercial no simulada: ${path}`);
}

function handleStoreAdmin(resource, params, method, body) {
  if (resource === "/store-admin/customers")
    return [
      {
        id: "account",
        status: "ACTIVE",
        customer: {
          firstName: "Ana",
          lastName: "Pérez",
          email: "ana@example.test",
        },
      },
    ];
  if (resource === "/store-admin/settings") {
    if (method === "PATCH") Object.assign(settings, body);
    return settings;
  }
  if (resource === "/store-admin/products")
    return [{ id: product.id, name: product.name, storeVisible: true }];
  if (resource === "/store-admin/methods") return methods;
  if (resource === "/store-admin/integration") return { configured: false };
  if (resource === "/store-admin/payment-events") return [];
  if (resource === "/store-admin/orders") return order ? [order] : [];
  if (resource === "/store-admin/orders/order") {
    if (method === "PATCH") {
      assert.equal(body.version, order.version);
      if (body.action === "APPROVE_PAYMENT") {
        assert.ok(body.reference.length >= 5);
        order.paymentStatus = "PAID";
        order.status = "CONFIRMED";
        order.saleId = "sale";
      }
      if (body.action === "PREPARE") order.fulfillment = "PREPARING";
      if (body.action === "READY") order.fulfillment = "READY_FOR_PICKUP";
      if (body.action === "DELIVER") {
        order.fulfillment = "DELIVERED";
        order.status = "COMPLETED";
      }
      order.version++;
    }
    return order;
  }
  throw new Error(`Ruta administrativa no simulada: ${resource}`);
}

async function runStoreChecks(page, origin) {
  const base = `${origin}/tienda/negocio-demo`;
  product.imageUrl = `data:image/png;base64,${(await bwip.toBuffer({ bcid: "qrcode", text: "producto", scale: 2 })).toString("base64")}`;
  await page.goto(`${base}/registro`);
  await page.getByLabel("Nombres", { exact: true }).fill("Ana");
  await page.getByLabel("Apellidos", { exact: true }).fill("Pérez");
  await page.getByLabel("Correo", { exact: true }).fill("ana@example.test");
  await page
    .getByLabel("Contraseña (mínimo 8 caracteres)", { exact: true })
    .fill("Buyer-Password-123");
  await page
    .getByLabel("Repite tu contraseña", { exact: true })
    .fill("No-coincide-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Las contraseñas no coinciden" })
    .waitFor();
  assert.equal(registrationRequests, 0);
  await page
    .getByLabel("Repite tu contraseña", { exact: true })
    .fill("Buyer-Password-123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "verificación" }).waitFor();
  await page.goto(`${base}/ingresar`);
  await page.getByLabel("Correo", { exact: true }).fill("ana@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Buyer-Password-123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/catalogo");
  await page
    .getByRole("heading", { name: "Café de la casa", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.title === "Catálogo · Almacén de origen",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `catálogo ${width}px`,
    );
    if (process.env.STORE_SCREENSHOT_DIR && [390, 1440].includes(width))
      await page.screenshot({
        path: path.join(
          process.env.STORE_SCREENSHOT_DIR,
          `tienda-catalogo-${width}.png`,
        ),
        fullPage: true,
      });
  }
  if (process.env.STORE_SCREENSHOT_DIR) {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({
      path: path.join(
        process.env.STORE_SCREENSHOT_DIR,
        "tienda-catalogo-oscuro.png",
      ),
      fullPage: true,
    });
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark"),
    );
  }
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await page.getByLabel("DNI", { exact: true }).fill("00123456");
  await page.getByLabel("Teléfono", { exact: true }).fill("+51999111222");
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Datos guardados" })
    .waitFor();
  await page.getByRole("link", { name: "Catálogo", exact: true }).click();
  await page
    .getByRole("spinbutton", {
      name: "Cantidad de Café de la casa",
      exact: true,
    })
    .fill("2");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "agregado" }).waitFor();
  assert.equal(await page.getByTestId("cart-count").textContent(), "2");
  const productImage = page.getByRole("img", {
    name: product.name,
    exact: true,
  });
  await productImage.waitFor();
  await page.waitForFunction(() =>
    Array.from(document.images).some(
      (image) =>
        image.alt === "Café de la casa" &&
        image.complete &&
        image.naturalWidth > 0,
    ),
  );
  await page.getByRole("link", { name: "Carrito", exact: true }).click();
  await page
    .getByRole("button", { name: "Aumentar Café de la casa", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="cart-count"]')?.textContent === "3",
  );
  await page
    .getByRole("button", { name: "Disminuir Café de la casa", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="cart-count"]')?.textContent === "2",
  );
  await page
    .getByRole("spinbutton", {
      name: "Cantidad en carrito de Café de la casa",
      exact: true,
    })
    .fill("4");
  await page
    .getByRole("spinbutton", {
      name: "Cantidad en carrito de Café de la casa",
      exact: true,
    })
    .press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="cart-count"]')?.textContent === "4",
  );
  await page.getByText("Av. Comercio 123", { exact: true }).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `carrito ${width}px`,
    );
    if (process.env.STORE_SCREENSHOT_DIR && width === 390)
      await page.screenshot({
        path: path.join(
          process.env.STORE_SCREENSHOT_DIR,
          "tienda-carrito-390.png",
        ),
        fullPage: true,
      });
  }
  assert.equal(
    await page
      .getByRole("radio", { name: "Entrega deshabilitada", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("radio", { name: "Entrega del negocio", exact: true })
    .check();
  await page
    .getByText("Agrega una dirección para recibir tu compra.", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Calcular total", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("radio", { name: "Efectivo al retirar", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("link", { name: "Administrar direcciones", exact: true })
    .click();
  await page.getByLabel("Nombre de dirección", { exact: true }).fill("Casa");
  await page.getByLabel("Destinatario", { exact: true }).fill("Ana Pérez");
  await page.getByLabel("Teléfono", { exact: true }).fill("999111222");
  await page.getByLabel("Dirección", { exact: true }).fill("Jr. Lima 100");
  await page
    .getByLabel("Ubigeo del distrito (6 dígitos)", { exact: true })
    .fill("150101");
  await page
    .getByRole("button", { name: "Agregar dirección", exact: true })
    .click();
  await page.getByText("Jr. Lima 100 · 150101", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Carrito", exact: true }).click();
  await page
    .getByRole("radio", { name: "Entrega del negocio", exact: true })
    .check();
  await page
    .getByRole("combobox", { name: "Dirección de entrega", exact: true })
    .selectOption("address");
  await page
    .getByRole("radio", { name: "Yape del negocio", exact: true })
    .check();
  await page
    .getByText("Paga a la cuenta del negocio", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Calcular total", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar pedido con este total",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("radio", { name: "Retiro en local", exact: true })
    .check();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Confirmar pedido con este total",
        exact: true,
      })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Dirección de entrega", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("radio", { name: "Yape del negocio", exact: true })
    .check();
  await page
    .getByRole("radio", { name: "Retiro en local", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Calcular total", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar pedido con este total",
      exact: true,
    })
    .click();
  await page.waitForURL("**/pedidos/order");
  await page
    .getByRole("heading", { name: "WEB-TEST-001", exact: true })
    .waitFor();
  const buffer = await bwip.toBuffer({
    bcid: "qrcode",
    text: "comprobante de prueba",
    scale: 2,
  });
  await page
    .getByLabel("Comprobante de pago", { exact: true })
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer });
  await page
    .getByRole("button", { name: "Enviar comprobante", exact: true })
    .click();
  await page.getByText("En revisión", { exact: true }).waitFor();
  await page.goto(`${origin}/store`);
  await page.getByRole("button", { name: /WEB-TEST-001/ }).click();
  await page
    .getByLabel("Referencia del cobro, devolución o seguimiento", {
      exact: true,
    })
    .fill("YAPE-REAL-001");
  await page
    .getByRole("button", { name: "Registrar cobro confirmado", exact: true })
    .click();
  await page.getByText("Pagado", { exact: true }).waitFor();
  for (const name of ["Preparar", "Listo para retirar", "Entregado"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByText(
        name === "Preparar"
          ? "En preparación"
          : name === "Entregado"
            ? "Entregado"
            : "Listo para retirar",
        { exact: true },
      )
      .and(page.locator("span"))
      .waitFor();
  }
  await page.goto(`${base}/pedidos/order`);
  await page.getByText("Completado", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log(
    "PASS: registro, acceso comercial, perfil, catálogo, carrito, cotización, pedido, comprobante, atención administrativa y entrega; vista móvil sin desbordamiento",
  );
}

module.exports = { handleStore, handleStoreAdmin, runStoreChecks };
