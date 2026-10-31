/**
 * Grabación de etiquetas NFC con Web NFC. Solo existe en Chrome para Android (y solo en
 * páginas https): en otros navegadores se ofrece el QR, que abre la misma dirección.
 * Leer una etiqueta no necesita nada de esto: el móvil la abre solo como un enlace.
 */

/** Parte mínima de la API Web NFC que usamos (no está en los tipos estándar de TypeScript). */
type NdefWriter = {
  write(message: { records: { recordType: "url"; data: string }[] }): Promise<void>;
};
type NdefWriterConstructor = new () => NdefWriter;

function writerConstructor(): NdefWriterConstructor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { NDEFReader?: NdefWriterConstructor }).NDEFReader;
  return ctor ?? null;
}

/** ¿Puede este navegador grabar etiquetas NFC? */
export function canWriteNfc(): boolean {
  return writerConstructor() !== null && window.isSecureContext;
}

/** Traduce los errores de Web NFC a mensajes claros. */
function describeNfcError(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError") return "Permiso de NFC denegado. Actívalo en los ajustes del navegador.";
  if (name === "NotSupportedError") return "Este móvil no tiene NFC o lo tiene apagado.";
  if (name === "AbortError") return "Se canceló la grabación.";
  return "No se pudo grabar la etiqueta. Acércala a la parte trasera del móvil e inténtalo de nuevo.";
}

/**
 * Graba una dirección en una etiqueta NFC. Pide acercar la etiqueta al móvil y espera
 * a que termine; lanza un `Error` con un mensaje en español si falla.
 */
export async function writeNfcUrl(url: string): Promise<void> {
  const Writer = writerConstructor();
  if (!Writer) throw new Error("Este navegador no puede grabar NFC. Usa Chrome en un móvil Android.");
  try {
    await new Writer().write({ records: [{ recordType: "url", data: url }] });
  } catch (e) {
    throw new Error(describeNfcError(e));
  }
}
