import { describe, expect, it } from "vitest";
import {
  MAX_PER_DISH,
  cartReducer,
  countItems,
  parseStoredCart,
  totalCents,
} from "./cart";
import type { Dish } from "./types";

const dishes: Dish[] = [
  { id: "a", name: "A", description: "", priceCents: 1299, category: "X", emoji: "🍔" },
  { id: "b", name: "B", description: "", priceCents: 450, category: "X", emoji: "🍋" },
];

describe("cartReducer", () => {
  it("agrega un plato nuevo", () => {
    expect(cartReducer([], { type: "add", dishId: "a", quantity: 2 })).toEqual([
      { dishId: "a", quantity: 2 },
    ]);
  });

  it("suma la cantidad si el plato ya está", () => {
    const lines = [{ dishId: "a", quantity: 2 }];
    expect(cartReducer(lines, { type: "add", dishId: "a", quantity: 3 })).toEqual([
      { dishId: "a", quantity: 5 },
    ]);
  });

  it("no pasa del máximo por plato", () => {
    const lines = [{ dishId: "a", quantity: MAX_PER_DISH - 1 }];
    expect(cartReducer(lines, { type: "add", dishId: "a", quantity: 5 })).toEqual([
      { dishId: "a", quantity: MAX_PER_DISH },
    ]);
  });

  it("ignora cantidades inválidas al agregar", () => {
    expect(cartReducer([], { type: "add", dishId: "a", quantity: 0 })).toEqual([]);
    expect(cartReducer([], { type: "add", dishId: "a", quantity: -3 })).toEqual([]);
    expect(cartReducer([], { type: "add", dishId: "a", quantity: NaN })).toEqual([]);
  });

  it("setQuantity cambia la cantidad y con 0 quita el plato", () => {
    const lines = [{ dishId: "a", quantity: 2 }];
    expect(
      cartReducer(lines, { type: "setQuantity", dishId: "a", quantity: 4 }),
    ).toEqual([{ dishId: "a", quantity: 4 }]);
    expect(
      cartReducer(lines, { type: "setQuantity", dishId: "a", quantity: 0 }),
    ).toEqual([]);
  });

  it("remove y clear vacían lo esperado", () => {
    const lines = [
      { dishId: "a", quantity: 1 },
      { dishId: "b", quantity: 1 },
    ];
    expect(cartReducer(lines, { type: "remove", dishId: "a" })).toEqual([
      { dishId: "b", quantity: 1 },
    ]);
    expect(cartReducer(lines, { type: "clear" })).toEqual([]);
  });

  it("no muta el estado anterior", () => {
    const lines = [{ dishId: "a", quantity: 1 }];
    cartReducer(lines, { type: "add", dishId: "a", quantity: 1 });
    expect(lines).toEqual([{ dishId: "a", quantity: 1 }]);
  });
});

describe("totales", () => {
  const lines = [
    { dishId: "a", quantity: 2 },
    { dishId: "b", quantity: 3 },
  ];

  it("cuenta las unidades", () => {
    expect(countItems(lines)).toBe(5);
  });

  it("suma en céntimos sin errores de decimales", () => {
    expect(totalCents(lines, dishes)).toBe(1299 * 2 + 450 * 3);
  });

  it("ignora platos que ya no existen", () => {
    expect(totalCents([{ dishId: "zzz", quantity: 2 }], dishes)).toBe(0);
  });
});

describe("parseStoredCart", () => {
  it("lee un carrito válido", () => {
    expect(parseStoredCart('[{"dishId":"a","quantity":2}]')).toEqual([
      { dishId: "a", quantity: 2 },
    ]);
  });

  it("devuelve vacío con null, JSON roto o formato incorrecto", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("{no es json")).toEqual([]);
    expect(parseStoredCart('{"dishId":"a"}')).toEqual([]);
  });

  it("descarta entradas inválidas y duplicadas, y limita la cantidad", () => {
    const raw = JSON.stringify([
      { dishId: "a", quantity: 999 },
      { dishId: "a", quantity: 1 },
      { dishId: 5, quantity: 1 },
      { dishId: "b", quantity: -2 },
      null,
      "x",
    ]);
    expect(parseStoredCart(raw)).toEqual([{ dishId: "a", quantity: MAX_PER_DISH }]);
  });
});
