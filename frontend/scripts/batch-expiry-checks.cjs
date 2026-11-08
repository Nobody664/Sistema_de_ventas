const assert = require("node:assert/strict");

const batches = [
  {
    id: "expired-a",
    productId: "milk",
    product: {
      id: "milk",
      name: "Leche de ejemplo",
      sku: "LECHE",
      baseUnit: "UNIT",
      isActive: true,
    },
    batchNumber: "LOTE-VENCIDO",
    expirationDate: "2026-11-07",
    daysLeft: -1,
    quantityReceived: "5",
    quantityAvailable: "3",
    reservedQuantity: "0",
    purchasePrice: "2",
    lossAmount: "6.00",
    branchName: null,
    updatedAt: "2026-11-07T10:00:00.000Z",
  },
  {
    id: "soon-a",
    productId: "milk",
    product: {
      id: "milk",
      name: "Leche de ejemplo",
      sku: "LECHE",
      baseUnit: "UNIT",
      isActive: true,
    },
    batchNumber: "LOTE-POR-VENCER",
    expirationDate: "2026-11-11",
    daysLeft: 3,
    quantityReceived: "4",
    quantityAvailable: "4",
    reservedQuantity: "0",
    purchasePrice: "4",
    lossAmount: "16.00",
    branchName: null,
    updatedAt: "2026-11-07T10:00:00.000Z",
  },
  {
    id: "fresh-a",
    productId: "milk",
    product: {
      id: "milk",
      name: "Leche de ejemplo",
      sku: "LECHE",
      baseUnit: "UNIT",
      isActive: true,
    },
    batchNumber: "LOTE-NUEVO-VIGENTE",
    expirationDate: "2026-11-12",
    daysLeft: 4,
    quantityReceived: "5",
    quantityAvailable: "5",
    reservedQuantity: "0",
    purchasePrice: "5",
    lossAmount: "25.00",
    branchName: null,
    updatedAt: "2026-11-07T10:00:00.000Z",
  },
  {
    id: "inherited-a",
    productId: "juice",
    product: {
      id: "juice",
      name: "Jugo de ejemplo",
      sku: "JUGO",
      baseUnit: "UNIT",
      isActive: true,
    },
    batchNumber: "LOTE-FECHA-PRODUCTO",
    expirationDate: "2026-11-05",
    expiryInherited: true,
    daysLeft: -3,
    quantityReceived: "4",
    quantityAvailable: "4",
    reservedQuantity: "0",
    purchasePrice: "3",
    lossAmount: "12.00",
    branchName: null,
    updatedAt: "2026-11-07T10:00:00.000Z",
  },
  {
    id: "reserved-a",
    productId: "bread",
    product: {
      id: "bread",
      name: "Pan de ejemplo",
      sku: "PAN",
      baseUnit: "UNIT",
      isActive: true,
    },
    batchNumber: "LOTE-RESERVADO",
    expirationDate: "2026-11-06",
    daysLeft: -2,
    quantityReceived: "2",
    quantityAvailable: "2",
    reservedQuantity: "1",
    purchasePrice: "3",
    lossAmount: "6.00",
    branchName: null,
    updatedAt: "2026-11-07T10:00:00.000Z",
  },
];
const writes = [];

function handleBatchExpiry(resource, params, method, body) {
  if (resource === "/batch-expiry") {
    let rows = batches.filter(
      (batch) => Number(batch.quantityAvailable) > 0 && batch.daysLeft <= 3,
    );
    if (params.get("productId"))
      rows = rows.filter(
        (batch) => batch.productId === params.get("productId"),
      );
    const search = (params.get("search") || "").toLowerCase();
    rows = rows.filter((batch) =>
      `${batch.product.name} ${batch.product.sku} ${batch.batchNumber}`
        .toLowerCase()
        .includes(search),
    );
    const counts = {
      expired: rows.filter((batch) => batch.daysLeft < 0).length,
      expiring: rows.filter((batch) => batch.daysLeft >= 0).length,
    };
    if (params.get("status") === "EXPIRED")
      rows = rows.filter((batch) => batch.daysLeft < 0);
    if (params.get("status") === "EXPIRING")
      rows = rows.filter((batch) => batch.daysLeft >= 0);
    return {
      today: "2026-11-08",
      lastDay: "2026-11-11",
      timezone: "America/Lima",
      currency: "PEN",
      page: 1,
      total: rows.length,
      totalPages: rows.length ? 1 : 0,
      counts,
      data: rows,
    };
  }
  if (method === "POST" && resource.endsWith("/write-off")) {
    const id = resource.split("/")[2];
    const batch = batches.find((item) => item.id === id);
    assert.ok(batch);
    assert.equal(body.expectedQuantityAvailable, batch.quantityAvailable);
    assert.equal(body.expectedPurchasePrice, batch.purchasePrice);
    assert.equal(body.expectedUpdatedAt, batch.updatedAt);
    assert.equal("lossAmount" in body, false);
    assert.equal("companyId" in body, false);
    const result = {
      batchId: id,
      batchNumber: batch.batchNumber,
      productId: batch.productId,
      quantity: batch.quantityAvailable,
      remainingStock: "9",
      lossAmount: batch.lossAmount,
      currency: "PEN",
      financeRecordId: `finance-${id}`,
      movementId: `movement-${id}`,
    };
    batch.quantityAvailable = "0";
    writes.push(result);
    return result;
  }
  throw new Error(`Ruta de vencimientos no simulada: ${resource}`);
}

async function runBatchExpiryChecks(page, origin) {
  await page.goto(`${origin}/expired-batches`);
  await page
    .getByRole("heading", { name: "Lotes de productos vencidos", exact: true })
    .waitFor();
  const table = page.getByRole("table", {
    name: "Lotes vencidos o por vencer con saldo pendiente de baja",
  });
  await table.getByText("LOTE-VENCIDO", { exact: true }).waitFor();
  await table.getByText("LOTE-FECHA-PRODUCTO", { exact: true }).waitFor();
  assert.equal(
    await table.getByText("Fecha del producto", { exact: true }).count(),
    1,
  );
  assert.equal(
    await table.getByText("LOTE-NUEVO-VIGENTE", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", {
        name: "Dar de baja lote LOTE-RESERVADO",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Dar de baja lote LOTE-VENCIDO", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(writes.length, 0);
  await page
    .getByRole("button", { name: "Confirmar baja y pérdida", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Baja registrada: lote LOTE-VENCIDO" })
    .waitFor();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("tbody td")).some(
        (cell) => cell.textContent.trim() === "LOTE-VENCIDO",
      ),
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].lossAmount, "6.00");
  assert.equal(
    batches.find((batch) => batch.id === "fresh-a").quantityAvailable,
    "5",
  );
  assert.equal(
    batches.find((batch) => batch.id === "soon-a").quantityAvailable,
    "4",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Ver pérdida en finanzas" })
      .getAttribute("href"),
    "/finance",
  );
  await page
    .getByRole("combobox", { name: "Estado de vencimiento", exact: true })
    .selectOption("EXPIRING");
  await table.getByText("LOTE-POR-VENCER", { exact: true }).waitFor();
  await page
    .getByRole("button", {
      name: "Dar de baja lote LOTE-POR-VENCER",
      exact: true,
    })
    .click();
  await page
    .getByText("El lote aún no ha vencido.", { exact: false })
    .waitFor();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.equal(writes.length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  console.log(
    "PASS: módulo de lotes, rango de 3 días, reservas bloqueadas, confirmación por lote, pérdida calculada, lotes vigentes intactos, baja anticipada cancelable y vista móvil",
  );
}

module.exports = { handleBatchExpiry, runBatchExpiryChecks };
