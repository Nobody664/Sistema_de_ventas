import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured before running the FAQ seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

type SeedFaq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  sortOrder: number;
};

const FAQS: SeedFaq[] = [
  {
    id: "faq-start-01",
    category: "Primeros pasos",
    question: "¿Cómo empiezo a usar el sistema?",
    answer:
      "Regístrate en Crear cuenta (/sign-up). Quedarás como COMPANY_ADMIN de tu empresa. Si tu empresa requiere aprobación, un administrador de plataforma la revisará. Al entrar verás el Dashboard y el menú lateral con los módulos habilitados según tu plan. Completa tu Perfil y revisa tu Suscripción.",
    keywords: ["registro", "empezar", "cuenta", "onboarding", "inicio"],
    sortOrder: 10,
  },
  {
    id: "faq-start-02",
    category: "Primeros pasos",
    question: "¿Por qué no veo un módulo en el menú?",
    answer:
      "Puede que tu rol no tenga permiso para ese módulo o que tu plan no lo incluya. Revisa tu Suscripción y solicita un upgrade si necesitas la función. Si el plan sí la incluye, pide a un COMPANY_ADMIN que revise tu rol en Empleados.",
    keywords: ["modulo", "menu", "permiso", "plan", "upgrade", "rol"],
    sortOrder: 11,
  },
  {
    id: "faq-start-03",
    category: "Primeros pasos",
    question: "¿Cómo creo usuarios para mi equipo?",
    answer:
      "Abre Empleados y crea cada usuario con su rol (Manager, Cajero, Viewer). El sistema respeta el límite de empleados de tu plan. Cada colaborador accede solo a lo que le corresponde según su rol.",
    keywords: ["empleados", "usuarios", "equipo", "crear", "rol"],
    sortOrder: 12,
  },
  {
    id: "faq-start-04",
    category: "Primeros pasos",
    question: "¿Qué diferencia hay entre los roles?",
    answer:
      "SUPER_ADMIN gestiona toda la plataforma; SUPPORT_ADMIN atiende soporte global; COMPANY_ADMIN administra por completo su empresa; MANAGER gestiona operación (inventario, ventas, compras); CASHIER vende y registra clientes con acceso limitado; VIEWER solo tiene lectura (reportes y dashboard).",
    keywords: ["roles", "permisos", "admin", "manager", "cajero", "viewer"],
    sortOrder: 13,
  },
  {
    id: "faq-sales-01",
    category: "Ventas",
    question: "¿Cómo registro una venta?",
    answer:
      "Abre Ventas → Nueva venta. Agrega productos escaneando o buscando, ajusta cantidades, selecciona un cliente (opcional), aplica un cupón si corresponde y elige el método de pago. Confirma la venta para descontar stock y registrarla en el historial.",
    keywords: ["venta", "pos", "registrar", "cobrar", "vender"],
    sortOrder: 20,
  },
  {
    id: "faq-sales-02",
    category: "Ventas",
    question: "¿Las ventas descuentan stock automáticamente?",
    answer:
      "Sí. Cada venta descuenta inventario, registra el movimiento en el Kardex y puede generar alertas de stock bajo. Si vendes con presentaciones (caja, pack), el sistema descuenta la cantidad equivalente en unidades base.",
    keywords: ["stock", "inventario", "descuento", "kardex", "automatico"],
    sortOrder: 21,
  },
  {
    id: "faq-sales-03",
    category: "Ventas",
    question: "¿Cómo imprimo la boleta o factura de una venta?",
    answer:
      "Entra al detalle de la venta y pulsa Imprimir. El comprobante usa las plantillas configuradas (A4 o térmica) e incluye cliente, productos con su descripción y SKU, cantidades, precios, importes y totales.",
    keywords: ["boleta", "factura", "imprimir", "comprobante", "ticket"],
    sortOrder: 22,
  },
  {
    id: "faq-sales-04",
    category: "Ventas",
    question: "¿Cómo anulo o reembolso una venta?",
    answer:
      "Desde el detalle de la venta puedes cancelarla o reembolsarla. El reembolso revierte el inventario y puede originar una nota de crédito. Todos los movimientos quedan registrados para auditoría.",
    keywords: ["anular", "reembolso", "devolucion", "cancelar", "nota de credito"],
    sortOrder: 23,
  },
  {
    id: "faq-sales-05",
    category: "Ventas",
    question: "¿Cómo aplico un cupón o descuento?",
    answer:
      "Crea el cupón en Cupones definiendo tipo (porcentaje o monto fijo), valor, vigencia y usos máximos. En Ventas ingrésalo en el campo de cupón; el sistema lo valida antes de aplicarlo.",
    keywords: ["cupon", "descuento", "promocion", "codigo"],
    sortOrder: 24,
  },
  {
    id: "faq-sales-06",
    category: "Ventas",
    question: "¿Puedo exportar el historial de ventas?",
    answer:
      "Sí. En el historial de Ventas usa Exportar y elige CSV, Excel o PDF. La exportación incluye número, estado, cliente, vendedor, productos, descripción, SKU, total, método de pago y fecha.",
    keywords: ["exportar", "historial", "ventas", "excel", "csv", "pdf"],
    sortOrder: 25,
  },
  {
    id: "faq-inventory-01",
    category: "Inventario",
    question: "¿Cómo repongo productos agotados?",
    answer:
      "Usa las Auto-órdenes en Órdenes de compra. Se generan a partir de los productos cuyo stock está en el mínimo o por debajo. Previsualiza las sugerencias y luego genera la orden para el proveedor.",
    keywords: ["reponer", "agotado", "auto orden", "compra", "stock bajo"],
    sortOrder: 30,
  },
  {
    id: "faq-inventory-02",
    category: "Inventario",
    question: "¿Cómo registro una entrada de mercadería?",
    answer:
      "Abre Inventario → Entradas y crea una Nueva entrada. Elige el proveedor (o General), agrega productos y cantidades con su costo y confirma. El stock sube, se registra en el Kardex y puedes emitir la boleta o recepción del proveedor.",
    keywords: ["entrada", "compra", "recepcion", "proveedor", "stock"],
    sortOrder: 31,
  },
  {
    id: "faq-inventory-03",
    category: "Inventario",
    question: "¿Qué es el Kardex y cómo lo uso?",
    answer:
      "Es la tarjeta de control de cada producto con entradas, salidas y saldo valorizado. Permite calcular el costo de ventas y el valor del inventario (PEPS/FIFO, UEPS/LIFO, Promedio o PMP) y analizar rentabilidad. Filtra por producto y rango de fechas.",
    keywords: ["kardex", "valorizacion", "costo", "inventario", "rentabilidad"],
    sortOrder: 32,
  },
  {
    id: "faq-inventory-04",
    category: "Inventario",
    question: "¿Cómo controlo los productos que vencen?",
    answer:
      "Con Lotes y vencimientos. Al registrar una entrada asigna lote y fecha de vencimiento; consulta Por vencer para anticiparte y usa Reservar para apartar stock. El sistema envía alertas automáticas de los próximos vencimientos.",
    keywords: ["lotes", "vencimiento", "caducidad", "alertas", "reservar"],
    sortOrder: 33,
  },
  {
    id: "faq-inventory-05",
    category: "Inventario",
    question: "¿Cómo ajusto el stock por diferencias?",
    answer:
      "Usa Inventario → Ajustes para corregir cantidades por mermas, conteos o errores. Cada ajuste queda registrado en el Kardex y en la auditoría, manteniendo la trazabilidad.",
    keywords: ["ajuste", "inventario", "merma", "conteo", "diferencia"],
    sortOrder: 34,
  },
  {
    id: "faq-inventory-06",
    category: "Inventario",
    question: "¿Cómo sé qué productos tienen stock bajo?",
    answer:
      "En Inventario filtra por Bajo stock. También recibirás notificaciones automáticas cuando un producto llegue a su mínimo, con sugerencias de reposición.",
    keywords: ["stock bajo", "minimo", "alerta", "notificacion", "reposicion"],
    sortOrder: 35,
  },
  {
    id: "faq-distributors-01",
    category: "Distribuidores",
    question: "¿Distribuidor y proveedor son lo mismo?",
    answer:
      "No. El distribuidor te compra o recibe mercadería de ti (extremo de salida); el proveedor te vende a ti (extremo de entrada). Por eso se gestionan en módulos distintos.",
    keywords: ["distribuidor", "proveedor", "diferencia", "salida", "entrada"],
    sortOrder: 40,
  },
  {
    id: "faq-distributors-02",
    category: "Distribuidores",
    question: "¿Cómo entrego mercadería en consignación?",
    answer:
      "Abre Salidas a distribuidores, elige un distribuidor activo, agrega productos y cantidades y confirma. También puedes hacerlo desde el detalle del distribuidor con Transferir. El stock sale de tu almacén y queda el historial de la salida.",
    keywords: ["consignacion", "salida", "distribuidor", "transferir", "entrega"],
    sortOrder: 41,
  },
  {
    id: "faq-distributors-03",
    category: "Distribuidores",
    question: "¿Cómo se calcula la deuda de un distribuidor?",
    answer:
      "La deuda nace al consignar: se suma cantidad × precio de venta de catálogo de cada producto entregado. Reportar una venta del distribuidor ya no vuelve a sumar deuda (solo mueve el stock consignado), así no se cuenta dos veces.",
    keywords: ["deuda", "distribuidor", "consignacion", "precio", "saldo"],
    sortOrder: 42,
  },
  {
    id: "faq-distributors-04",
    category: "Distribuidores",
    question: "¿Cómo registro lo que vendió el distribuidor?",
    answer:
      "En el detalle del distribuidor registra la venta y sus entregas. La venta mueve las cantidades del stock en consigna a vendido, sin alterar la deuda que ya se generó al entregar la mercadería.",
    keywords: ["venta distribuidor", "reportar", "consigna", "vendido"],
    sortOrder: 43,
  },
  {
    id: "faq-distributors-05",
    category: "Distribuidores",
    question: "¿Cómo liquido la deuda de un distribuidor?",
    answer:
      "En el detalle del distribuidor usa Liquidar e ingresa el monto. La deuda disminuye y el pago se registra automáticamente como ingreso en Finanzas, para que tu balance quede actualizado.",
    keywords: ["liquidar", "liquidacion", "pago", "deuda", "finanzas"],
    sortOrder: 44,
  },
  {
    id: "faq-purchases-01",
    category: "Compras",
    question: "¿Cómo creo y recibo una orden de compra?",
    answer:
      "Abre Órdenes de compra, crea una orden con proveedor, productos y cantidades, y actualiza su estado según avance. Cuando llegue la mercadería pulsa Recibir: se genera automáticamente la entrada de stock y el movimiento de Kardex.",
    keywords: ["orden de compra", "proveedor", "recibir", "compra"],
    sortOrder: 50,
  },
  {
    id: "faq-purchases-02",
    category: "Compras",
    question: "¿Cómo funcionan las auto-órdenes?",
    answer:
      "Son sugerencias de compra generadas desde los productos con stock igual o menor al mínimo. Usa Previsualizar para revisar productos y cantidades antes de Generar la orden.",
    keywords: ["auto orden", "sugerencia", "reposicion", "compra"],
    sortOrder: 51,
  },
  {
    id: "faq-finance-01",
    category: "Finanzas",
    question: "¿Cómo registro ingresos y gastos?",
    answer:
      "Abre Finanzas y crea un Nuevo registro indicando tipo (ingreso o gasto), monto, categoría, descripción y fecha. En Resumen verás el balance del período (ingresos vs gastos).",
    keywords: ["finanzas", "ingreso", "gasto", "balance", "resumen"],
    sortOrder: 60,
  },
  {
    id: "faq-finance-02",
    category: "Finanzas",
    question: "¿Las liquidaciones de distribuidores afectan Finanzas?",
    answer:
      "Sí. Al registrar una liquidación, además de reducir la deuda del distribuidor, el sistema crea un ingreso (ENTRY) en Finanzas con la descripción y referencia del distribuidor.",
    keywords: ["liquidacion", "finanzas", "ingreso", "distribuidor"],
    sortOrder: 61,
  },
  {
    id: "faq-finance-03",
    category: "Finanzas",
    question: "¿Cómo descargo reportes del negocio?",
    answer:
      "Abre Reportes, elige el tipo (ventas, inventario o clientes) y el rango de fechas, y descarga en PDF o Excel. Requiere un plan con reports.basic.",
    keywords: ["reportes", "pdf", "excel", "descargar", "informe"],
    sortOrder: 62,
  },
  {
    id: "faq-account-01",
    category: "Cuenta y plan",
    question: "¿Cómo pago mi plan?",
    answer:
      "Desde Pagos puedes pagar con MercadoPago o subir un comprobante (Yape, Plin o transferencia) para revisión. También consultas tu historial de pagos y descargas recibos.",
    keywords: ["pago", "plan", "suscripcion", "mercadopago", "yape", "plin"],
    sortOrder: 70,
  },
  {
    id: "faq-account-02",
    category: "Cuenta y plan",
    question: "¿Cómo cambio o mejoro mi plan?",
    answer:
      "Entra a Pagos o Suscripción, elige el nuevo plan y paga o sube tu comprobante. La solicitud queda en revisión y, al aprobarse, se desbloquean los módulos incluidos.",
    keywords: ["cambiar plan", "upgrade", "mejorar", "suscripcion"],
    sortOrder: 71,
  },
  {
    id: "faq-account-03",
    category: "Cuenta y plan",
    question: "¿Dónde veo mis notificaciones?",
    answer:
      "Abre Notificaciones desde el menú. Las no leídas se resaltan; puedes marcarlas como leídas o usar Marcar todo como leído. La campana muestra el contador de no leídas en vivo.",
    keywords: ["notificaciones", "campana", "alertas", "leido"],
    sortOrder: 72,
  },
  {
    id: "faq-support-01",
    category: "Soporte",
    question: "¿Cómo creo un ticket de soporte?",
    answer:
      "Abre Soporte → Tickets y crea uno Nuevo describiendo el problema. Podrás seguir la conversación, agregar comentarios y cerrarlo cuando se resuelva.",
    keywords: ["ticket", "soporte", "problema", "incidencia", "ayuda"],
    sortOrder: 80,
  },
  {
    id: "faq-support-02",
    category: "Soporte",
    question: "¿Puedo chatear con el equipo de soporte?",
    answer:
      "Sí. En Soporte → Chat de soporte puedes conversar en vivo con el equipo. Si la conversación requiere seguimiento, conviértela en ticket sin perder el historial.",
    keywords: ["chat", "soporte", "conversacion", "tiempo real"],
    sortOrder: 81,
  },
];

async function main() {
  for (const faq of FAQS) {
    await prisma.supportFaq.upsert({
      where: { id: faq.id },
      update: {
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        sortOrder: faq.sortOrder,
        isPublished: true,
      },
      create: {
        id: faq.id,
        scope: "GLOBAL",
        companyId: null,
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        sortOrder: faq.sortOrder,
        isPublished: true,
      },
    });
  }

  const total = await prisma.supportFaq.count({ where: { scope: "GLOBAL" } });
  console.log(`Seed FAQs OK: ${FAQS.length} preguntas cargadas (${total} globales en total).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
