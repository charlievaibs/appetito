import { connection } from "next/server";
import { fetchVerifiedApk, type ApkFailure } from "@/lib/apk-verify";
import { RELEASE } from "@/lib/release";

const MESSAGES: Record<ApkFailure, string> = {
  "no-release": "Todavía no hay una versión para Android publicada.",
  "bad-config": "La configuración de la descarga no es válida. Avisa al equipo de Appetito.",
  upstream: "No pudimos obtener el archivo ahora mismo. Inténtalo de nuevo en unos minutos.",
  redirect: "Descarga bloqueada: el archivo vino de un origen no permitido.",
  "too-large": "Descarga bloqueada: el archivo tiene un tamaño inesperado.",
  "hash-mismatch": "Descarga bloqueada: el archivo no coincide con la versión oficial de Appetito.",
};

/**
 * Entrega el APK oficial. No admite parámetros: la versión y la huella esperadas están
 * fijadas en el código, y el archivo solo se sirve si su SHA-256 coincide.
 */
export async function GET() {
  await connection(); // siempre se resuelve al pedirlo, no al compilar
  const result = await fetchVerifiedApk(RELEASE);

  if (!result.ok) {
    return new Response(MESSAGES[result.reason], {
      status: result.reason === "no-release" ? 404 : 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return new Response(result.bytes as BodyInit, {
    headers: {
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": `attachment; filename="appetito-${RELEASE?.version}.apk"`,
      "content-length": String(result.bytes.byteLength),
      "x-content-type-options": "nosniff",
      // Se puede guardar en la red de reparto: solo contiene bytes ya verificados.
      "cache-control": "public, max-age=300, s-maxage=86400",
      "x-appetito-sha256": RELEASE?.sha256 ?? "",
    },
  });
}
