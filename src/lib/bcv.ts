/**
 * Tasa oficial del Banco Central de Venezuela (https://www.bcv.org.ve/), leída de su portada.
 * Solo se usa en el servidor (ruta /api/tasas): el navegador no puede consultar el BCV por CORS.
 *
 * La verificación TLS queda siempre activa; solo se añade el certificado intermedio que el BCV
 * no envía (ver bcv-ca.ts). Si el BCV cambia su página o no responde, la función devuelve null
 * y la app sigue funcionando con la tasa manual del local.
 */
import https from "node:https";
import tls from "node:tls";
import { SECTIGO_R36_PEM } from "./bcv-ca";

export type RateSourceName = "bcv" | "dolarapi";

export type BcvRates = {
  /** Bolívares por dólar. */
  usd: number;
  /** Bolívares por euro. */
  eur: number;
  /** Fecha valor que publica el BCV, AAAA-MM-DD. */
  date: string;
  /** De dónde salió: el BCV directamente o DolarApi (respaldo, que replica la tasa oficial). */
  source: RateSourceName;
};

const BCV_URL = "https://www.bcv.org.ve/";
const MAX_BYTES = 2_000_000;

/** Convierte "889,57540000" (formato del BCV) en 889.5754. Devuelve null si no es un número razonable. */
export function parseBcvNumber(text: string): number | null {
  const value = Number(text.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 100_000_000 ? value : null;
}

/** Extrae dólar, euro y fecha valor del HTML de la portada del BCV; null si no tiene la forma esperada. */
export function parseBcvRates(html: string): BcvRates | null {
  const read = (id: string) =>
    new RegExp(`id="${id}"[\\s\\S]{0,600}?<strong[^>]*>\\s*([0-9.,]+)\\s*</strong>`).exec(html)?.[1] ?? "";
  const usd = parseBcvNumber(read("dolar"));
  const eur = parseBcvNumber(read("euro"));
  const date = /Fecha Valor:[\s\S]{0,200}?content="(\d{4}-\d{2}-\d{2})/.exec(html)?.[1];
  return usd && eur && date ? { usd, eur, date, source: "bcv" } : null;
}

function download(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { ca: [...tls.rootCertificates, SECTIGO_R36_PEM], timeout: 10_000 }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`BCV respondió ${response.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error("Respuesta demasiado grande"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    request.on("timeout", () => request.destroy(new Error("BCV tardó demasiado")));
    request.on("error", reject);
  });
}

/** Lee la respuesta de DolarApi (`/v1/dolares/oficial` o `/v1/euros/oficial`): promedio y fecha. */
export function parseDolarApi(json: unknown): { rate: number; date: string } | null {
  if (typeof json !== "object" || json === null) return null;
  const { promedio, fechaActualizacion } = json as Record<string, unknown>;
  const rate = typeof promedio === "number" && promedio > 0 && promedio < 100_000_000 ? promedio : null;
  const date = typeof fechaActualizacion === "string" ? /^\d{4}-\d{2}-\d{2}/.exec(fechaActualizacion)?.[0] : null;
  return rate && date ? { rate, date } : null;
}

const DOLARAPI = "https://ve.dolarapi.com/v1";

async function fetchDolarApiRates(): Promise<BcvRates | null> {
  try {
    const get = async (path: string) => {
      const response = await fetch(`${DOLARAPI}${path}`, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
      return response.ok ? parseDolarApi(await response.json()) : null;
    };
    const [usd, eur] = await Promise.all([get("/dolares/oficial"), get("/euros/oficial")]);
    return usd && eur ? { usd: usd.rate, eur: eur.rate, date: usd.date, source: "dolarapi" } : null;
  } catch {
    return null;
  }
}

/**
 * Tasas oficiales: primero directamente del BCV (la fuente) y, si no responde, de DolarApi
 * (gratuita, replica la tasa oficial aunque a veces con unos días de retraso). Null si ambas fallan.
 */
export async function fetchBcvRates(): Promise<BcvRates | null> {
  try {
    const direct = parseBcvRates(await download(BCV_URL));
    if (direct) return direct;
  } catch {
    // Sin respuesta del BCV: se prueba el respaldo.
  }
  return fetchDolarApiRates();
}
