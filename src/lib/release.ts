/**
 * La versión de la app Android que ofrece la web, fijada EN EL CÓDIGO.
 *
 * El enlace de descarga no sale de ninguna variable de entorno ni de ningún panel: solo
 * cambia con un commit en este archivo (que además exige la huella SHA-256 del APK). La
 * ruta `/descargar` descarga el APK desde GitHub, comprueba esa huella y solo entonces
 * lo entrega; si no coincide, no se sirve nada (ver `apk-verify.ts`).
 *
 * Para publicar una versión nueva: compilar con el flujo «Android APK», copiar versión
 * y huella (aparecen en el resumen de la ejecución) y hacer commit de este archivo.
 */

/** Repositorio de GitHub del que se descargan las versiones. */
export const RELEASE_REPO = "charlievaibs/appetito";

/** Versión publicada y huella SHA-256 (hex en minúsculas) de su appetito.apk; null si aún no hay. */
export const RELEASE: { version: string; sha256: string } | null = null;

/**
 * Huella SHA-256 del certificado con el que se firma el APK (la clave nunca cambia entre
 * versiones). Permite comprobar `apksigner verify --print-certs`; null hasta crear la clave.
 */
export const SIGNING_CERT_SHA256: string | null = null;

export const VERSION_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Dirección exacta del APK de una versión en GitHub Releases. */
export function apkSourceUrl(version: string): string {
  if (!VERSION_PATTERN.test(version)) throw new Error("Versión no válida");
  return `https://github.com/${RELEASE_REPO}/releases/download/v${version}/appetito.apk`;
}
