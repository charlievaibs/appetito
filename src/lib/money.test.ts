import { describe, expect, it } from "vitest";
import { formatPrice, parsePriceToCents } from "./money";

describe("parsePriceToCents", () => {
  it("acepta enteros, punto y coma decimal", () => {
    expect(parsePriceToCents("12")).toBe(1200);
    expect(parsePriceToCents("12.5")).toBe(1250);
    expect(parsePriceToCents("12,50")).toBe(1250);
    expect(parsePriceToCents(" 0,29 ")).toBe(29);
  });

  it("rechaza valores inválidos", () => {
    for (const bad of ["", "abc", "-3", "1.234", "1,2,3", "12 €"]) {
      expect(parsePriceToCents(bad)).toBeNull();
    }
  });
});

describe("formatPrice", () => {
  it("formatea céntimos en dólares", () => {
    expect(formatPrice(1299)).toBe("$12.99");
    expect(formatPrice(0)).toBe("$0.00");
  });
});
