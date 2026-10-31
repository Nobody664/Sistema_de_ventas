export type Locale = "es" | "en";
export const localeFromValue = (value: unknown): Locale =>
  value === "en" ? "en" : "es";

const english: Record<string, string> = {
  "Datos de la empresa actualizados correctamente":
    "Company details updated successfully",
  "El nombre de la empresa es requerido": "The company name is required",
  "El RUC debe tener 11 dígitos": "The tax ID must contain 11 digits",
  "No se pudo verificar la sesión": "Could not verify the session",
  "Reintenta la comprobación antes de editar la empresa.":
    "Retry the session check before editing the company.",
  "Comprobando acceso...": "Checking access...",
  "Acceso restringido": "Restricted access",
  "Solo el administrador de la empresa puede editar la información de la organización.":
    "Only the company administrator can edit the organization's information.",
  "Volver al inicio": "Back to dashboard",
  "No se pudieron cargar los datos de la empresa":
    "Could not load company details",
  "Cargando datos de la empresa...": "Loading company details...",
  Empresa: "Company",
  "Datos de la Empresa": "Company details",
  "Gestiona la información legal, fiscal y de contacto":
    "Manage legal, tax, and contact information",
  "Información Principal": "Main information",
  "Nombre de la Empresa": "Company name",
  "Mi Empresa SAC": "My Company Ltd",
  "Razón Social": "Legal name",
  "Mi Empresa Sociedad Anónima Cerrada": "My Company's Registered Legal Name",
  "Identificación Fiscal": "Tax identification",
  "(Registro Único de Contribuyente)":
    "(Peruvian taxpayer registration number)",
  "El RUC debe tener 11 dígitos para ser válido":
    "A valid Peruvian tax ID contains 11 digits",
  Ubicación: "Location",
  "Dirección Fiscal": "Registered address",
  "Av. Principal 123, Lima, Perú": "123 Main Avenue, Lima, Peru",
  Contacto: "Contact",
  "Correo Electrónico": "Email address",
  Teléfono: "Phone number",
  "Los cambios se aplicarán inmediatamente": "Changes will apply immediately",
  "Guardando...": "Saving...",
  "Guardar Cambios": "Save changes",
  "Región del negocio": "Business region",
  "Zona horaria": "Timezone",
  "Zona horaria del negocio actualizada": "Business timezone updated",
  "No se pudo verificar la sesión para editar el negocio.":
    "Could not verify the session to edit this business.",
  "Reintentar sesión": "Retry session",
  "No se pudo cargar la configuración.": "Could not load settings.",
  "Define cómo se muestran las fechas y dónde comienzan los días del dashboard y los reportes. Los movimientos mantienen su instante original en UTC.":
    "Controls how dates are displayed and where dashboard and report days begin. Transactions retain their original UTC timestamps.",
  "Moneda del negocio": "Business currency",
  "La moneda se conserva para no reinterpretar importes históricos.":
    "The currency is preserved so historical amounts are not reinterpreted.",
  "Guardar región": "Save region",
  "Cargando configuración regional...": "Loading regional settings...",
  "Lima · Perú": "Lima · Peru",
  "Bogotá · Colombia": "Bogotá · Colombia",
  "Ciudad de México · México": "Mexico City · Mexico",
  "No se pudo comprobar el perfil de la empresa.":
    "Could not check the company profile.",
  Perfil: "Profile",
  completo: "complete",
  de: "of",
  "campos completados": "fields completed",
  Falta: "Missing",
  Completar: "Complete profile",
  "Zona de peligro": "Danger zone",
  "Estas acciones son irreversibles": "These actions cannot be undone",
  "Solicitar cierre del negocio": "Request business closure",
  "Cancelar suscripción": "Cancel subscription",
  "Solo el administrador de la empresa puede cancelar la suscripción.":
    "Only the company administrator can cancel the subscription.",
  "La eliminación de cuenta no está disponible en esta versión; contacta al soporte si necesitas cerrar la empresa.":
    "Account deletion is not available in this version; contact support if you need to close the business.",
  "Tu suscripción se marcará como cancelada y la renovación automática se desactivará. Esta acción no se puede deshacer.":
    "Your subscription will be marked as cancelled and automatic renewal will be disabled. This action cannot be undone.",
  Volver: "Back",
  "Confirmar cancelación": "Confirm cancellation",
  "Suscripción cancelada correctamente": "Subscription cancelled successfully",
  Configuración: "Settings",
  Plataforma: "Platform",
  "Tu espacio de trabajo": "Your workspace",
  "Personaliza tu experiencia y administra los datos de tu negocio.":
    "Customize your experience and manage your business data.",
  "Personaliza la apariencia y accede a las opciones de tu cuenta.":
    "Customize the appearance and access your account settings.",
  "Mi perfil": "My profile",
  "Tu cuenta de administrador de plataforma.":
    "Your platform administrator account.",
  "Administrar plataforma": "Manage platform",
  "Empresas, planes y herramientas globales.":
    "Companies, plans, and platform tools.",
  "Métodos de pago globales": "Platform payment methods",
  "Configuración de los medios de cobro de la plataforma.":
    "Configure the platform's payment methods.",
  "Datos personales y seguridad de tu cuenta.":
    "Your personal information and account security.",
  "Datos de la empresa": "Company details",
  "Nombre, RUC, dirección y contacto del negocio.":
    "Business name, tax ID, address, and contact information.",
  "Mi plan": "My plan",
  "Consulta la suscripción y sus características.":
    "Review your subscription and its features.",
  "Mis pagos": "My payments",
  "Revisa pagos y envía comprobantes.":
    "Review payments and submit payment receipts.",
  "Opciones de cuenta": "Account options",
  Apariencia: "Appearance",
  Tema: "Theme",
  Claro: "Light",
  Oscuro: "Dark",
  Sistema: "System",
  "Se aplica de inmediato y se guarda en este navegador. El botón del encabezado usa esta misma preferencia.":
    "Changes apply immediately and are saved in this browser. The header button uses the same preference.",
  "Alertas dentro del sistema": "In-app notifications",
  "Preferencias de tu usuario en este negocio. Se aplican a las nuevas alertas; el historial se conserva. Los avisos de cuenta y pagos siguen activos.":
    "Your notification preferences for this business. They apply to new alerts; history is preserved. Account and payment notices remain enabled.",
  "Ventas registradas": "Recorded sales",
  "Stock bajo y vencimientos": "Low stock and expiration dates",
  "Sonido de nuevas alertas": "New notification sound",
  "Guardar alertas": "Save notifications",
  "Preferencias guardadas.": "Preferences saved.",
  "Cargando preferencias...": "Loading preferences...",
  "No se pudieron cargar las preferencias.": "Could not load preferences.",
  Reintentar: "Retry",
  Idioma: "Language",
  "Guardar idioma": "Save language",
  "Idioma guardado.": "Language saved.",
  Español: "Español",
  Inglés: "English",
  "Configura el idioma de Configuración y de tus resúmenes y avisos Web Push. Los datos escritos por usuarios conservan su idioma original.":
    "Choose the language for Settings, daily summaries, and Web Push notices. User-entered data keeps its original language.",
  "Datos del negocio": "Business data",
  "Descargar datos JSON": "Download JSON data",
  "Exportando...": "Exporting...",
  "Cancelar exportación": "Cancel export",
  "Archivo JSON descargado.": "JSON file downloaded.",
  "Exportación cancelada.": "Export cancelled.",
  "Preparando exportación...": "Preparing export...",
  "Descarga tus datos operativos en JSON versionado: catálogo, ventas, compras, inventario, contactos y finanzas. No incluye credenciales ni datos de plataforma.":
    "Download your operational data as versioned JSON: catalog, sales, purchases, inventory, contacts, and finances. Credentials and platform data are excluded.",
  "Se lee por lotes y puede reflejar cambios durante la descarga. No es un respaldo físico ni un archivo de restauración automática. Límite de descarga: 100 MiB.":
    "Data is read in batches and may reflect changes made during the download. This is not a database backup or an automatic restore file. Download limit: 100 MiB.",
  "API Keys de solo lectura": "Read-only API keys",
  "Conecta sistemas externos sin compartir tu contraseña. Cada clave pertenece a este negocio, vence a los 90 días y puede revocarse. Las consultas consumen la cuota mensual de API de tu plan.":
    "Connect external systems without sharing your password. Each key belongs to this business, expires after 90 days, and can be revoked. Requests consume your plan's monthly API quota.",
  "Tu plan no incluye acceso a la API. Puedes consultar y revocar claves existentes.":
    "Your plan does not include API access. You can still view and revoke existing keys.",
  "Nombre de la integración": "Integration name",
  "Permisos de lectura": "Read permissions",
  "Consultar catálogo": "Read catalog",
  "Consultar stock": "Read stock",
  "Consultar ventas": "Read sales",
  "Crear API Key": "Create API key",
  "Clave creada. Guarda el valor ahora; no podrás volver a consultarlo.":
    "Key created. Save it now; you will not be able to retrieve it again.",
  "Clave revocada.": "Key revoked.",
  "Valor visible solo en esta respuesta": "Value shown only in this response",
  "Nueva API Key": "New API key",
  "Ocultar clave": "Hide key",
  "Cargando claves...": "Loading keys...",
  Revocada: "Revoked",
  Revocar: "Revoke",
  Vence: "Expires",
  "Contrato de consulta": "Read API contract",
  "GET /api/integrations/v1/catalog · /inventory · /sales. Envía la clave en X-API-Key. Cada respuesta incluye hasta 100 registros y nextCursor; usa ?after=nextCursor para continuar. Los decimales se devuelven como cadenas. No hay endpoints de escritura.":
    "GET /api/integrations/v1/catalog · /inventory · /sales. Send the key in X-API-Key. Responses contain up to 100 records and nextCursor; use ?after=nextCursor to continue. Decimal values are returned as strings. No write endpoints are available.",
  "No se pudieron cargar las claves.": "Could not load API keys.",
  "Webhooks salientes": "Outgoing webhooks",
  "Envía el evento sale.created a tu integración por HTTPS. La entrega es al menos una vez: usa X-Ventas-Delivery para deduplicar y valida la firma HMAC del cuerpo antes de procesarlo.":
    "Send sale.created events to your HTTPS integration. Delivery is at least once: deduplicate using X-Ventas-Delivery and verify the body's HMAC signature before processing.",
  "Tu plan no incluye webhooks salientes.":
    "Your plan does not include outgoing webhooks.",
  "El canal necesita una clave de cifrado y hosts de destino habilitados en el servidor.":
    "This channel requires a server encryption key and enabled destination hosts.",
  "Hosts habilitados": "Enabled hosts",
  "Nombre del webhook": "Webhook name",
  "URL HTTPS de destino": "Destination HTTPS URL",
  "Crear webhook": "Create webhook",
  "Webhook creado. Guarda el secreto de firma; se muestra una sola vez.":
    "Webhook created. Save the signing secret; it is shown only once.",
  "Webhook desactivado.": "Webhook disabled.",
  "Secreto de firma": "Signing secret",
  "Ocultar secreto": "Hide secret",
  Activo: "Active",
  Desactivado: "Disabled",
  "Ver entregas de": "View deliveries for",
  Desactivar: "Disable",
  "Últimas 50 entregas": "Last 50 deliveries",
  "Todavía no hay entregas.": "No deliveries yet.",
  "Cargando entregas...": "Loading deliveries...",
  Entregado: "Delivered",
  Detenido: "Stopped",
  Pendiente: "Pending",
  intentos: "attempts",
  "sin respuesta": "no response",
  "Verificación y reintentos": "Verification and retries",
  "No se pudieron cargar los webhooks.": "Could not load webhooks.",
  "No se pudo cargar el historial.": "Could not load delivery history.",
  'X-Ventas-Signature contiene v1=HMAC-SHA256(secreto, timestamp + "." + cuerpo JSON exacto). Verifica X-Ventas-Timestamp con una tolerancia de cinco minutos. El identificador de entrega permanece estable durante hasta diez intentos con espera creciente, de uno a sesenta minutos. No se siguen redirecciones.':
    'X-Ventas-Signature contains v1=HMAC-SHA256(secret, timestamp + "." + exact JSON body). Verify X-Ventas-Timestamp within a five-minute tolerance. Delivery IDs remain stable across up to ten attempts with increasing delays from one to sixty minutes. Redirects are not followed.',
  "Canales de notificación": "Notification channels",
  "Resumen diario por correo": "Daily email summary",
  "Resumen de las ventas completadas del día anterior, enviado a las 08:00 de la zona horaria del negocio al correo de tu cuenta.":
    "A summary of the previous day's completed sales, sent at 08:00 in the business timezone to your account's email address.",
  "El correo no está habilitado en el servidor.":
    "Email delivery is not enabled on the server.",
  "Recibir resumen diario": "Receive daily summary",
  "Preferencia de resumen guardada.": "Summary preference saved.",
  "Web Push en el navegador": "Browser Web Push",
  "Recibe avisos genéricos del sistema con la pestaña cerrada, según el soporte del navegador y del sistema operativo. El contenido del negocio solo se muestra al abrir tu sesión.":
    "Receive generic system notices with the tab closed, subject to browser and operating system support. Business details are shown only after opening your authenticated session.",
  "Este navegador no ofrece Web Push en el contexto actual.":
    "This browser does not support Web Push in the current context.",
  "El canal necesita claves VAPID y cifrado habilitados en el servidor.":
    "This channel requires server-side VAPID keys and encryption.",
  "Activar en este navegador": "Enable in this browser",
  "Este navegador quedó registrado para Web Push.":
    "This browser is now registered for Web Push.",
  "Navegador eliminado de Web Push.": "Browser removed from Web Push.",
  Navegador: "Browser",
  "Eliminar navegador": "Remove browser",
  "No se pudo cargar la preferencia.": "Could not load the preference.",
  "No se pudo cargar Web Push.": "Could not load Web Push settings.",
};

export function translate(locale: Locale, text: string): string {
  return locale === "en" && Object.hasOwn(english, text) ? english[text] : text;
}
