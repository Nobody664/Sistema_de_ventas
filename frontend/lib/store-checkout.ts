export function createStoreCheckoutKey(
  cryptoSource: Pick<Crypto, "getRandomValues"> &
    Partial<Pick<Crypto, "randomUUID">> = globalThis.crypto,
): string {
  if (!cryptoSource)
    throw new Error(
      "No se pudo preparar la confirmación. Recarga la página e intenta nuevamente.",
    );
  if (typeof cryptoSource.randomUUID === "function")
    return cryptoSource.randomUUID();
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
