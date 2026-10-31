import { describe, expect, it } from "vitest";
import {
  describeRate,
  formatPriceFor,
  parseBcvResponse,
  grossCents,
  parsePricingSettings,
  pickRate,
  toVesCents,
  USD_ONLY,
  type BcvRates,
  type PricingSettings,
} from "./rates";

const bcv: BcvRates = { usd: 889.5754, eur: 991.25386822, date: "2026-11-02" };
const base = (patch: Partial<PricingSettings>): PricingSettings => ({ ...USD_ONLY, ...patch });

describe("parsePricingSettings (etiqueta y menú)", () => {
  it("lee la etiqueta y si el menú muestra precios", () => {
    expect(parsePricingSettings({ price_label: "eur", menu_prices_visible: false })).toMatchObject({ label: "eur", menuPricesVisible: false });
  });

  it("por defecto usa REF y muestra los precios", () => {
    expect(parsePricingSettings({ price_display: "both" })).toMatchObject({ label: "ref", menuPricesVisible: true });
  });
});

describe("parsePricingSettings", () => {
  it("lee la configuración del local", () => {
    expect(parsePricingSettings({ price_display: "both", rate_source: "manual", manual_rate: "900.5", manual_rate_at: "2026-11-02T10:00:00Z" })).toEqual({
      display: "both",
      source: "manual",
      manualRate: 900.5,
      manualRateAt: "2026-11-02T10:00:00Z",
      label: "ref",
      menuPricesVisible: true,
      vatPercent: 0,
      pricesIncludeVat: false,
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

  it("marca el precio como REF, dólar o euro", () => {
    expect(formatPriceFor(1299, base({ label: "ref" }), null)).toBe("REF 12.99");
    expect(formatPriceFor(1299, base({ label: "eur" }), null)).toBe("€12.99");
    expect(formatPriceFor(1299, base({ label: "ref", display: "both" }), 889.5754)).toBe("REF 12.99 · Bs 11.555,58");
  });

  it("sin tasa se queda en la moneda base", () => {
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

describe("IVA", () => {
  it("calcula el importe con IVA por línea y redondea al céntimo", () => {
    expect(grossCents(1750, 16)).toBe(2030);
    expect(grossCents(2250, 16)).toBe(2610);
    expect(grossCents(1000, 0)).toBe(1000);
    expect(grossCents(333, 16)).toBe(386); // 386,28
    expect(grossCents(1, 16)).toBe(1); // 1,16
  });

  it("lee el IVA del local y descarta valores raros", () => {
    expect(parsePricingSettings({ vat_percent: "16.00", prices_include_vat: true })).toMatchObject({ vatPercent: 16, pricesIncludeVat: true });
    expect(parsePricingSettings({ vat_percent: -5 }).vatPercent).toBe(0);
    expect(parsePricingSettings({ vat_percent: 500 }).vatPercent).toBe(0);
    expect(parsePricingSettings({}).pricesIncludeVat).toBe(false);
  });
});
