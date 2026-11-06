const assert = require("node:assert/strict");

async function runAvatarChecks(page, origin) {
  await page.goto(`${origin}/profile`);
  await page
    .getByRole("button", { name: "Cambiar foto", exact: true })
    .waitFor();
  const original = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1100;
    canvas.height = 1100;
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(1100, 1100);
    for (let offset = 0; offset < pixels.data.length; offset += 65536) {
      crypto.getRandomValues(pixels.data.subarray(offset, offset + 65536));
    }
    for (let offset = 3; offset < pixels.data.length; offset += 4)
      pixels.data[offset] = 255;
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const buffer = Buffer.from(original, "base64");
  assert.ok(buffer.length > 2_000_000 && buffer.length < 5 * 1024 * 1024);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/me/avatar") &&
      response.request().method() === "PATCH",
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "avatar-grande.png",
      mimeType: "image/png",
      buffer,
    });
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const uploaded = response.request().postDataJSON().avatarUrl;
  assert.ok(uploaded.startsWith("data:image/webp;base64,"));
  assert.ok(uploaded.length < 2_000_000);
  await page.waitForFunction(
    () =>
      Array.from(document.images).filter((image) =>
        /Foto de|Avatar de/.test(image.alt),
      ).length >= 2 &&
      Array.from(document.images)
        .filter((image) => /Foto de|Avatar de/.test(image.alt))
        .every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Cambiar foto", exact: true })
    .waitFor();
  await page.waitForFunction(() =>
    Array.from(document.images).some(
      (image) =>
        image.alt.startsWith("Foto de") &&
        image.complete &&
        image.naturalWidth > 0,
    ),
  );
  await page
    .getByRole("button", { name: "Eliminar foto de perfil", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Eliminar foto de perfil", exact: true })
    .waitFor({ state: "hidden" });
  console.log(
    "PASS: avatar mayor a 2 MB se comprime antes del PATCH /api/auth/me/avatar, carga en perfil y cabecera, persiste al recargar y se elimina correctamente",
  );
}

module.exports = { runAvatarChecks };
