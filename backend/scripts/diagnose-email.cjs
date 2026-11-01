require("reflect-metadata");
require("dotenv/config");
const { randomUUID } = require("node:crypto");
const { ConfigService } = require("@nestjs/config");
const {
  EmailTransportService,
} = require("../dist/modules/email/email-transport.service.js");

function argument(name) {
  const at = process.argv.indexOf(name);
  if (at < 0) return undefined;
  const value = process.argv[at + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`Falta valor para ${name}`);
  return value;
}

async function renderConfig(serviceId, workspace) {
  if (!/^srv-[a-z0-9]+$/.test(serviceId) || !workspace)
    throw new Error("Indica --render-service y --workspace válidos");
  if (!process.env.RENDER_API_KEY)
    throw new Error(
      "Falta RENDER_API_KEY en este proceso; nunca la pases por argumentos",
    );
  const get = async (path) => {
    const response = await fetch(`https://api.render.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Render HTTP ${response.status}`);
    return response.json();
  };
  const service = await get(`services/${serviceId}`);
  if (service.ownerId !== workspace)
    throw new Error("El servicio no pertenece al workspace indicado");
  const values = {};
  let cursor = "";
  for (let page = 0; page < 10; page++) {
    const rows = await get(
      `services/${serviceId}/env-vars?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!Array.isArray(rows))
      throw new Error("Respuesta de configuración inesperada");
    for (const row of rows)
      if (row.envVar && /^(SMTP_|EMAIL_|RESEND_)/.test(row.envVar.key))
        values[row.envVar.key] = row.envVar.value;
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].cursor;
    if (!cursor)
      throw new Error("No se pudo completar la lectura de configuración");
  }
  return values;
}

(async () => {
  const service = argument("--render-service");
  const values = service
    ? await renderConfig(service, argument("--workspace"))
    : process.env;
  const override = argument("--sender");
  const settings = {
    ...values,
    ...(override ? { EMAIL_FROM_EMAIL: override } : {}),
  };
  const transport = new EmailTransportService(new ConfigService(settings));
  const status = transport.status();
  console.log(
    JSON.stringify(
      {
        execution: service ? "local_with_render_configuration" : "local",
        senderOverrideForThisTestOnly: !!override,
        ...status,
      },
      null,
      2,
    ),
  );
  if (!status.enabled || !status.configured) {
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify({ verification: await transport.verify() }, null, 2),
  );
  const to = argument("--send-to");
  if (!to) {
    console.log(
      "No se envió ningún correo. Usa --send-to para solicitar una prueba.",
    );
    return;
  }
  const id = argument("--test-id") ?? randomUUID();
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new Error("--test-id debe ser un UUID");
  console.log(`Identificador de prueba: ${id}`);
  const receipt = await transport.send({
    to,
    subject: "Prueba de correo - Sistema de ventas",
    text: "Mensaje de prueba para comprobar el envío de correos de la aplicación. No contiene enlaces de acceso ni datos de clientes.",
    messageId: `<email-test-${id}@notifications.ventas>`,
  });
  console.log(
    JSON.stringify(
      {
        receipt,
        note: "El proveedor aceptó el mensaje. La entrega se confirma en el dashboard del proveedor o en la bandeja del destinatario.",
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(
    JSON.stringify({
      error: error.code ?? error.message,
      httpStatus: error.status ?? null,
    }),
  );
  process.exitCode = 1;
});
