/**
 * Precios en bolívares. Los precios se guardan siempre en dólares (céntimos); aquí solo se
 * decide cómo MOSTRARLOS según la configuración de cada local y la tasa elegida.
 * Funciones puras, sin red ni navegador, para poder probarlas.
 */

export type PriceDisplay = "usd" | "ves" | "both";
export type RateSource = "bcv_usd" | "bcv_eur" | "manual";

/** Cómo muestra los precios un restaurante. */
export type PricingSettings = {
  display: PriceDisplay;
  source: RateSource;
  /** Bolívares por dólar fijados a mano por el local (solo con `source = "manual"`). */
  manualRate: number | null;
  manualRateAt: string | null;
};

/** Tasas oficiales del BCV (bolívares por unidad). */
export type BcvRates = { usd: number; eur: number; date: string; fresh?: boolean };

export const USD_ONLY: PricingSettings = { display: "usd", source: "bcv_usd", manualRate: null, manualRateAt: null };

const RATE_SOURCE_LABEL: Record<RateSource, string> = {
  bcv_usd: "BCV dólar",
  bcv_eur: "BCV euro",
  manual: "tasa del local",
};

/** Lee la configuración de precios que devuelven las funciones de la base de datos. */
export function parsePricingSettings(json: unknown): PricingSettings {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return USD_ONLY;
  const { price_display, rate_source, manual_rate, manual_rate_at } = json as Record<string, unknown>;
  const display: PriceDisplay = price_display === "ves" || price_display === "both" ? price_display : "usd";
  const source: RateSource = rate_source === "bcv_eur" || rate_source === "manual" ? rate_source : "bcv_usd";
  const manualRate = typeof manual_rate === "number" ? manual_rate : typeof manual_rate === "string" ? Number(manual_rate) : null;
  return {
    display,
    source,
    manualRate: manualRate !== null && Number.isFinite(manualRate) && manualRate > 0 ? manualRate : null,
    manualRateAt: typeof manual_rate_at === "string" ? manual_rate_at : null,
  };
}

/** Interpreta la respuesta de /api/tasas; null si no tiene la forma esperada. */
export function parseBcvResponse(json: unknown): BcvRates | null {
  if (typeof json !== "object" || json === null) return null;
  const { usd, eur, date, fresh } = json as Record<string, unknown>;
  if (typeof usd !== "number" || typeof eur !== "number" || typeof date !== "string") return null;
  return { usd, eur, date, fresh: fresh !== false };
}

/** La tasa (bolívares por dólar) que corresponde aplicar, o null si aún no se conoce. */
export function pickRate(settings: PricingSettings, bcv: BcvRates | null): number | null {
  if (settings.source === "manual") return settings.manualRate;
  if (!bcv) return null;
  return settings.source === "bcv_eur" ? bcv.eur : bcv.usd;
}

/** Convierte céntimos de dólar a céntimos de bolívar con la tasa dada. */
export function toVesCents(usdCents: number, rate: number): number {
  return Math.round(usdCents * rate);
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const ves = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Bs 11.558,00" */
export function formatVes(vesCents: number): string {
  return `Bs ${ves.format(vesCents / 100)}`;
}

/**
 * Da formato a un precio según el local. Sin tasa disponible se muestra en dólares (nunca se
 * inventa un importe en bolívares).
 */
export function formatPriceFor(usdCents: number, settings: PricingSettings, rate: number | null): string {
  if (settings.display === "usd" || rate === null) return usd.format(usdCents / 100);
  const bs = formatVes(toVesCents(usdCents, rate));
  return settings.display === "ves" ? bs : `${usd.format(usdCents / 100)} · ${bs}`;
}

/** Texto corto para explicar qué tasa se está usando ("BCV dólar: Bs 889,57 · 02/11/2026"). */
export function describeRate(settings: PricingSettings, bcv: BcvRates | null): string | null {
  const rate = pickRate(settings, bcv);
  if (rate === null) return null;
  const shown = `Bs ${ves.format(rate)}`;
  if (settings.source === "manual") {
    const day = settings.manualRateAt ? new Date(settings.manualRateAt).toLocaleDateString("es-VE") : null;
    return `${RATE_SOURCE_LABEL.manual}: ${shown}${day ? ` · ${day}` : ""}`;
  }
  const [y, m, d] = (bcv?.date ?? "").split("-");
  return `${RATE_SOURCE_LABEL[settings.source]}: ${shown}${y ? ` · ${d}/${m}/${y}` : ""}`;
}
