export interface DniIdentity {
  dni: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombreCompleto?: string;
  nombre?: string;
  telefono?: string;
  direccion?: string;
}

export function dniIdentityFields(data: DniIdentity, expected: string) {
  if (data.dni !== expected)
    throw new Error("La respuesta corresponde a otro DNI");
  const firstName = (
    data.nombres ||
    data.nombreCompleto ||
    data.nombre ||
    ""
  ).trim();
  if (!firstName)
    throw new Error("No se recibieron nombres válidos para este DNI");
  return {
    firstName,
    lastName: [data.apellidoPaterno, data.apellidoMaterno]
      .filter(Boolean)
      .join(" ")
      .trim(),
    phone: data.telefono,
    address: data.direccion,
  };
}
