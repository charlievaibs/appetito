import { connection } from "next/server";
import { fetchBcvRates, type BcvRates } from "@/lib/bcv";

/** Última tasa buena en memoria: evita consultar al BCV en cada visita y sirve de respaldo si falla. */
let cache: { rates: BcvRates; fetchedAt: number } | null = null;
const FRESH_MS = 20 * 60 * 1000;

/**
 * Tasas oficiales del BCV (dólar y euro en bolívares), para mostrar precios en bolívares.
 * Es pública, solo lectura y no admite parámetros. Si el BCV no responde se devuelve la última
 * tasa conocida (marcada como no fresca) o 503 si nunca hubo una.
 */
export async function GET() {
  await connection();

  if (!cache || Date.now() - cache.fetchedAt > FRESH_MS) {
    const rates = await fetchBcvRates();
    if (rates) cache = { rates, fetchedAt: Date.now() };
  }

  if (!cache) {
    return Response.json({ error: "No se pudo consultar al BCV" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const fresh = Date.now() - cache.fetchedAt <= FRESH_MS;
  return Response.json(
    { ...cache.rates, fresh },
    { headers: { "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
