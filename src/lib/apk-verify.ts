/**
 * Descarga verificada del APK. Es la defensa principal contra un APK manipulado: aunque
 * alguien lograra reemplazar el archivo en GitHub, esta función solo entrega bytes cuya
 * huella SHA-256 coincide con la que está fijada en el código (release.ts).
 *
 * Reglas, todas estrictas:
 * - La dirección sale únicamente de la versión fijada; nada de la petición la influye.
 * - Solo HTTPS y solo los dominios de GitHub; cada redirección se revisa a mano.
 * - Tamaño máximo; huella comparada en tiempo constante.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { apkSourceUrl, SHA256_PATTERN, VERSION_PATTERN } from "./release";

/** Dominios desde los que se acepta el APK (GitHub y su almacén de archivos de releases). */
const ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);
const MAX_REDIRECTS = 4;
export const MAX_APK_BYTES = 100 * 1024 * 1024;

export type ApkFailure = "no-release" | "bad-config" | "upstream" | "redirect" | "too-large" | "hash-mismatch";
export type ApkResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: ApkFailure };

function isAllowed(url: URL): boolean {
  return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname) && url.port === "";
}

export async function fetchVerifiedApk(
  release: { version: string; sha256: string } | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ApkResult> {
  if (!release) return { ok: false, reason: "no-release" };
  if (!VERSION_PATTERN.test(release.version) || !SHA256_PATTERN.test(release.sha256)) {
    return { ok: false, reason: "bad-config" };
  }

  let url = new URL(apkSourceUrl(release.version));
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowed(url)) return { ok: false, reason: "redirect" };
    try {
      response = await fetchImpl(url, { redirect: "manual", cache: "no-store", headers: { accept: "application/octet-stream" } });
    } catch {
      return { ok: false, reason: "upstream" };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, reason: "upstream" };
      try {
        url = new URL(location, url);
      } catch {
        return { ok: false, reason: "redirect" };
      }
      response = null;
      continue;
    }
    break;
  }
  if (!response) return { ok: false, reason: "redirect" };
  if (!response.ok) return { ok: false, reason: "upstream" };

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_APK_BYTES) return { ok: false, reason: "too-large" };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_APK_BYTES) return { ok: false, reason: "too-large" };

  const actual = createHash("sha256").update(bytes).digest();
  const expected = Buffer.from(release.sha256, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "hash-mismatch" };
  }
  return { ok: true, bytes };
}
