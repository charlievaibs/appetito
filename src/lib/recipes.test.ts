import { describe, expect, it } from "vitest";
import { parseRecipeQuantity, recipeCostCents, recipeMargin } from "./recipes";

const items = new Map([
  ["harina", { id: "harina", cost_cents: 200 }],
  ["queso", { id: "queso", cost_cents: 800 }],
]);

describe("recipeCostCents", () => {
  it("suma cantidad por costo unitario y redondea", () => {
    expect(recipeCostCents([{ item_id: "harina", quantity: 0.25 }, { item_id: "queso", quantity: 0.1 }], items)).toBe(130);
    expect(recipeCostCents([{ item_id: "harina", quantity: 0.333 }], items)).toBe(67);
  });

  it("un artículo desconocido o una receta vacía cuestan 0", () => {
    expect(recipeCostCents([{ item_id: "nada", quantity: 5 }], items)).toBe(0);
    expect(recipeCostCents([], items)).toBe(0);
  });
});

describe("recipeMargin", () => {
  it("calcula ganancia y porcentaje sobre el precio", () => {
    expect(recipeMargin(500, 130)).toEqual({ cents: 370, percent: 74 });
  });

  it("permite margen negativo y precio cero", () => {
    expect(recipeMargin(100, 150)).toEqual({ cents: -50, percent: -50 });
    expect(recipeMargin(0, 50)).toEqual({ cents: -50, percent: null });
  });
});

describe("parseRecipeQuantity", () => {
  it("acepta coma o punto y hasta 3 decimales", () => {
    expect(parseRecipeQuantity("0,25")).toBe(0.25);
    expect(parseRecipeQuantity(" 2 ")).toBe(2);
    expect(parseRecipeQuantity("0.125")).toBe(0.125);
  });

  it("rechaza cero, negativos, texto y demasiados decimales", () => {
    for (const bad of ["0", "-1", "abc", "", "1.2345", "1e3"]) expect(parseRecipeQuantity(bad)).toBeNull();
  });
});
