import { describe, expect, it } from "vitest";
import {
  describeRate,
  formatPriceFor,
  parseBcvResponse,
  parsePricingSettings,
  pickRate,
  toVesCents,
  USD_ONLY,
  type BcvRates,
  type PricingSettings,
} from "./rates";

const bcv: BcvRates = { usd: 889.5754, eur: 991.25386822, date: "2026-11-02" };
const base = (patch: Partial<PricingSettings>): PricingSettings => ({ ...USD_ONLY, ...patch });

describe("parsePricingSettings", () => {
  it("lee la configuración del local", () => {
    expect(parsePricingSettings({ price_display: "both", rate_source: "manual", manual_rate: "900.5", manual_rate_at: "2026-11-02T10:00:00Z" })).toEqual({
      display: "both",
      source: "manual",
      manualRate: 900.5,
      manualRateAt: "2026-11-02T10:00:00Z",
    });
  });

  it("usa dólares si no entiende lo recibido", () => {
    expect(parsePricingSettings(null)).toEqual(USD_ONLY);
    expect(parsePricingSettings({ price_display: "raro", manual_rate: -3 }).display).toBe("usd");
    expect(parsePricingSettings({ manual_rate: -3 }).manualRate).toBeNull();
  });
});

describe("pickRate", () => {
  it("elige dólar, euro o la tasa manual", () => {
    expect(pickRate(base({ source: "bcv_usd" }), bcv)).toBe(889.5754);
    expect(pickRate(base({ source: "bcv_eur" }), bcv)).toBe(991.25386822);
    expect(pickRate(base({ source: "manual", manualRate: 950 }), bcv)).toBe(950);
  });

  it("no inventa una tasa que no se conoce", () => {
    expect(pickRate(base({ source: "bcv_usd" }), null)).toBeNull();
    expect(pickRate(base({ source: "manual" }), bcv)).toBeNull();
  });
});

describe("formatPriceFor", () => {
  it("solo dólares", () => {
    expect(formatPriceFor(1299, base({ display: "usd" }), 889.5754)).toBe("$12.99");
  });

  it("convierte a bolívares con la tasa", () => {
    expect(toVesCents(1299, 889.5754)).toBe(1155558);
  });

  it("solo bolívares y ambos", () => {
    expect(formatPriceFor(1299, base({ display: "ves" }), 889.5754)).toBe("Bs 11.555,58");
    expect(formatPriceFor(1299, base({ display: "both" }), 889.5754)).toBe("$12.99 · Bs 11.555,58");
  });

  it("sin tasa se queda en dólares", () => {
    expect(formatPriceFor(1299, base({ display: "ves" }), null)).toBe("$12.99");
  });
});

describe("describeRate", () => {
  it("explica la tasa en uso", () => {
    expect(describeRate(base({ source: "bcv_usd" }), bcv)).toContain("BCV dólar");
    expect(describeRate(base({ source: "bcv_usd" }), bcv)).toContain("02/11/2026");
    expect(describeRate(base({ source: "bcv_usd" }), null)).toBeNull();
  });
});

describe("parseBcvResponse", () => {
  it("valida la respuesta de /api/tasas", () => {
    expect(parseBcvResponse({ usd: 1, eur: 2, date: "2026-11-02" })?.eur).toBe(2);
    expect(parseBcvResponse({ usd: "1" })).toBeNull();
  });
});
