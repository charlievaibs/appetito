import { describe, expect, it } from "vitest";
import type { OrderItem } from "./db";
import {
  billTotals,
  coverage,
  isSettled,
  needsReference,
  parsePaymentInfo,
  parsePaymentMethods,
  payableRows,
  selectionTotal,
} from "./payments";

/** Plato de prueba con solo lo que importa para cobrar. */
function item(id: string, unit: number, quantity = 1, status = "served"): OrderItem {
  return { id, unit_price_cents: unit, quantity, status } as OrderItem;
}

const items = [item("a", 450, 2), item("b", 450), item("c", 1000, 1, "cancelled")];

describe("coverage", () => {
  it("sin pagos todo está pendiente y los cancelados no cuentan", () => {
    const rows = coverage(items, [], []);
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(billTotals(rows)).toEqual({ total: 1350, paid: 0, pending: 0, remaining: 1350 });
  });

  it("separa lo confirmado de lo que espera confirmación e ignora lo rechazado", () => {
    const payments = [
      { id: "p1", status: "confirmed" },
      { id: "p2", status: "pending" },
      { id: "p3", status: "rejected" },
    ];
    const paymentItems = [
      { payment_id: "p1", item_id: "a", amount_usd_cents: 900 },
      { payment_id: "p2", item_id: "b", amount_usd_cents: 450 },
      { payment_id: "p3", item_id: "b", amount_usd_cents: 450 },
    ];
    const rows = coverage(items, paymentItems, payments);
    expect(billTotals(rows)).toEqual({ total: 1350, paid: 900, pending: 450, remaining: 0 });
    expect(isSettled(rows)).toBe(false); // todavía hay un pago por confirmar
  });

  it("la mesa queda saldada cuando todo está confirmado", () => {
    const payments = [{ id: "p1", status: "confirmed" }];
    const paymentItems = [
      { payment_id: "p1", item_id: "a", amount_usd_cents: 900 },
      { payment_id: "p1", item_id: "b", amount_usd_cents: 450 },
    ];
    expect(isSettled(coverage(items, paymentItems, payments))).toBe(true);
  });

  it("un pago parcial deja el resto por cubrir", () => {
    const rows = coverage(items, [{ payment_id: "p1", item_id: "a", amount_usd_cents: 300 }], [{ id: "p1", status: "confirmed" }]);
    expect(rows[0].remaining).toBe(600);
    expect(payableRows(rows)).toHaveLength(2);
  });
});

describe("coverage con IVA", () => {
  it("el total de cada línea incluye el IVA", () => {
    const rows = coverage(items, [], [], 16);
    expect(rows.map((r) => r.total)).toEqual([1044, 522]); // 900 y 450 con 16 %
    expect(billTotals(rows).total).toBe(1566);
  });

  it("un pago ya hecho con IVA deja la línea saldada", () => {
    const rows = coverage(items, [{ payment_id: "p1", item_id: "a", amount_usd_cents: 1044 }], [{ id: "p1", status: "confirmed" }], 16);
    expect(rows[0].remaining).toBe(0);
    expect(rows[1].remaining).toBe(522);
  });
});

describe("selectionTotal", () => {
  it("suma lo que falta de los platos elegidos", () => {
    const rows = coverage(items, [], []);
    expect(selectionTotal(rows, new Set(["a"]))).toBe(900);
    expect(selectionTotal(rows, new Set(["a", "b"]))).toBe(1350);
    expect(selectionTotal(rows, new Set())).toBe(0);
  });
});

describe("métodos", () => {
  it("lee solo los métodos conocidos", () => {
    expect(parsePaymentMethods(["cash", "bitcoin", "zelle"])).toEqual(["cash", "zelle"]);
    expect(parsePaymentMethods(null)).toEqual([]);
  });

  it("pide referencia en pago móvil, transferencia y Zelle", () => {
    expect(needsReference("pago_movil")).toBe(true);
    expect(needsReference("zelle")).toBe(true);
    expect(needsReference("cash")).toBe(false);
    expect(needsReference("card_pos")).toBe(false);
  });
});

describe("parsePaymentInfo", () => {
  it("lee métodos e instrucciones", () => {
    expect(parsePaymentInfo({ payment_methods: ["cash", "zelle"], payment_instructions: "Pago móvil 0414-0000000" })).toEqual({
      methods: ["cash", "zelle"],
      instructions: "Pago móvil 0414-0000000",
    });
  });

  it("tolera datos que faltan", () => {
    expect(parsePaymentInfo(null)).toEqual({ methods: [], instructions: null });
    expect(parsePaymentInfo({ payment_instructions: "   " }).instructions).toBeNull();
  });
});
