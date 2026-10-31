import { describe, expect, it } from "vitest";
import type { OptionGroup } from "./db";
import {
  canDinerEdit,
  describeChange,
  groupBy,
  isEditableStatus,
  itemsTotalCents,
  latestRequestFor,
  optionsDeltaCents,
  parseOptions,
  validateSelection,
} from "./order-items";

/** Crea un grupo de opciones de prueba. */
function group(over: Partial<OptionGroup> & { options: [string, number][] }): OptionGroup {
  const { options, ...rest } = over;
  return {
    id: "g",
    dish_id: "d",
    name: "Grupo",
    kind: "multiple",
    required: false,
    position: 0,
    ...rest,
    dish_options: options.map(([id, price], i) => ({
      id,
      group_id: "g",
      name: id,
      price_delta_cents: price,
      available: true,
      position: i,
    })),
  };
}

describe("parseOptions", () => {
  it("lee opciones válidas y descarta el resto", () => {
    const parsed = parseOptions([
      { group: "Extras", name: "Queso", price_delta_cents: 100 },
      { group: "Extras", name: 5 },
      "texto",
      null,
    ]);
    expect(parsed).toEqual([{ group: "Extras", name: "Queso", price_delta_cents: 100 }]);
  });

  it("devuelve vacío si no es una lista", () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions({ a: 1 })).toEqual([]);
  });
});

describe("itemsTotalCents", () => {
  it("suma precio × cantidad y no cobra los cancelados", () => {
    const total = itemsTotalCents([
      { unit_price_cents: 1399, quantity: 2, status: "pending" },
      { unit_price_cents: 450, quantity: 1, status: "served" },
      { unit_price_cents: 9999, quantity: 5, status: "cancelled" },
    ]);
    expect(total).toBe(1399 * 2 + 450);
  });
});

describe("isEditableStatus", () => {
  it("antes de cocina siempre se edita si está esperando", () => {
    expect(isEditableStatus("pending", "before_kitchen")).toBe(true);
    expect(isEditableStatus("preparing", "before_kitchen")).toBe(false);
  });

  it("con until_ready también se edita mientras se prepara, pero no cuando está listo", () => {
    expect(isEditableStatus("preparing", "until_ready")).toBe(true);
    expect(isEditableStatus("ready", "until_ready")).toBe(false);
    expect(isEditableStatus("served", "until_ready")).toBe(false);
    expect(isEditableStatus("cancelled", "until_ready")).toBe(false);
  });
});

describe("canDinerEdit", () => {
  const base = { userId: "u1", seatId: "s1", orderingMode: "qr" as const, policy: "before_kitchen" as const };

  it("puede editar lo que pidió o lo de su puesto", () => {
    expect(canDinerEdit({ added_by: "u1", seat_id: null, status: "pending" }, base)).toBe(true);
    expect(canDinerEdit({ added_by: "waiter", seat_id: "s1", status: "pending" }, base)).toBe(true);
  });

  it("no puede editar lo de otros", () => {
    expect(canDinerEdit({ added_by: "u2", seat_id: "s2", status: "pending" }, base)).toBe(false);
    expect(canDinerEdit({ added_by: "waiter", seat_id: null, status: "pending" }, base)).toBe(false);
  });

  it("no puede si el restaurante es solo atendido o si ya no es editable", () => {
    expect(canDinerEdit({ added_by: "u1", seat_id: null, status: "pending" }, { ...base, orderingMode: "staff" })).toBe(false);
    expect(canDinerEdit({ added_by: "u1", seat_id: null, status: "preparing" }, base)).toBe(false);
  });
});

describe("validateSelection", () => {
  const groups = [
    group({ id: "quitar", name: "Quitar", options: [["sin-salsa", 0], ["sin-cebolla", 0]] }),
    group({ id: "termino", name: "Término", kind: "single", required: true, options: [["medio", 0], ["bien", 0]] }),
  ];

  it("acepta una selección que cumple las reglas", () => {
    expect(validateSelection(groups, ["medio", "sin-salsa", "sin-cebolla"])).toBeNull();
  });

  it("exige una opción en los grupos obligatorios", () => {
    expect(validateSelection(groups, ["sin-salsa"])).toContain("Término");
  });

  it("no admite dos opciones en un grupo único", () => {
    expect(validateSelection(groups, ["medio", "bien"])).toContain("solo puedes elegir una");
  });
});

describe("optionsDeltaCents", () => {
  it("suma solo las opciones elegidas", () => {
    const groups = [group({ options: [["queso", 100], ["tocino", 150], ["nada", 0]] })];
    expect(optionsDeltaCents(groups, ["queso", "tocino"])).toBe(250);
    expect(optionsDeltaCents(groups, [])).toBe(0);
  });
});

describe("groupBy", () => {
  it("agrupa conservando el orden de aparición", () => {
    const result = groupBy(["a1", "b1", "a2"], (s) => s[0]);
    expect(result).toEqual([
      ["a", ["a1", "a2"]],
      ["b", ["b1"]],
    ]);
  });
});

describe("describeChange", () => {
  const current = { quantity: 2, note: null, optionNames: ["Sin cebolla"] };

  it("resume cantidad, opciones y nota", () => {
    expect(
      describeChange(current, { quantity: 1, note: "sin sal", optionNames: ["Sin salsa"] }),
    ).toBe("Cantidad 2 → 1 · Agregar: Sin salsa · Quitar: Sin cebolla · Nota: sin sal");
  });

  it("devuelve vacío si no cambia nada", () => {
    expect(describeChange(current, { quantity: 2, note: "", optionNames: ["Sin cebolla"] })).toBe("");
  });

  it("describe una cancelación", () => {
    expect(describeChange(current, { quantity: 0, note: "", optionNames: [] })).toBe("Cancelar el plato");
  });
});

describe("latestRequestFor", () => {
  it("devuelve la solicitud más reciente de ese plato", () => {
    const requests = [
      { item_id: "a", created_at: "2026-01-01T10:00:00Z", id: 1 },
      { item_id: "a", created_at: "2026-01-01T11:00:00Z", id: 2 },
      { item_id: "b", created_at: "2026-01-01T12:00:00Z", id: 3 },
    ];
    expect(latestRequestFor(requests, "a")?.id).toBe(2);
    expect(latestRequestFor(requests, "z")).toBeUndefined();
  });
});
