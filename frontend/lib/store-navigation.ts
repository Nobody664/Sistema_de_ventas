export const storeSectionNames: Record<string, string> = {
  catalogo: "Catálogo",
  carrito: "Carrito",
  perfil: "Mi perfil",
  direcciones: "Mis direcciones",
  pedidos: "Mis pedidos",
  pago: "Formas de pago",
  envio: "Opciones de entrega",
  ingresar: "Ingresar",
  registro: "Crear cuenta",
  recuperar: "Recuperar acceso",
  verificar: "Verificar correo",
  restablecer: "Nueva contraseña",
  privacidad: "Privacidad",
};

export function storePageTitle(name: string, section: string): string {
  return `${storeSectionNames[section] ?? "Tienda"} · ${name}`;
}
