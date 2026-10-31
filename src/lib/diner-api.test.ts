import { describe, expect, it } from "vitest";
import { parseSessionContext, parseTablesForJoin } from "./diner-api";

const valid = {
  session_id: "s1",
  status: "open",
  restaurant: {
    id: "r1",
    name: "Demo",
    slug: "demo",
    ordering_mode: "qr",
    identification: "table",
    change_policy: "before_kitchen",
  },
  table: { id: "t1", label: "Mesa 1", reserved_by: "Reserva de Juan" },
  participant: { seat_id: "p2", seat_label: "Puesto 2", display_name: "Ana" },
  seats: [
    { id: "p1", label: "Puesto 1" },
    { id: "p2", label: "Puesto 2" },
    { id: 5, label: "inválido" },
  ],
};

describe("parseSessionContext", () => {
  it("convierte la respuesta del servidor en un objeto tipado", () => {
    const ctx = parseSessionContext(valid);
    expect(ctx.sessionId).toBe("s1");
    expect(ctx.restaurant.orderingMode).toBe("qr");
    expect(ctx.table.reservedBy).toBe("Reserva de Juan");
    expect(ctx.participant?.seatLabel).toBe("Puesto 2");
  });

  it("descarta los puestos mal formados", () => {
    expect(parseSessionContext(valid).seats).toHaveLength(2);
  });

  it("acepta que quien consulta no sea comensal (personal)", () => {
    expect(parseSessionContext({ ...valid, participant: null }).participant).toBeNull();
  });

  it("falla con una respuesta que no es un objeto", () => {
    expect(() => parseSessionContext("hola")).toThrow(/Respuesta inesperada/);
    expect(() => parseSessionContext({ ...valid, restaurant: null })).toThrow();
  });
});

describe("parseTablesForJoin", () => {
  it("lee mesas, estados y asientos", () => {
    const parsed = parseTablesForJoin({
      restaurant: { id: "r", name: "Demo", manual_join: "open" },
      tables: [
        { id: "t1", label: "Mesa 1", capacity: 4, status: "occupied", seats: [{ id: "s1", label: "A", taken: true }, { id: "s2", label: "B", taken: false }] },
        { id: "t2", label: "Mesa 2", capacity: 2, status: "rara", seats: [] },
        { label: "sin id" },
      ],
    });
    expect(parsed?.manualJoin).toBe("open");
    expect(parsed?.tables).toHaveLength(2);
    expect(parsed?.tables[0].status).toBe("occupied");
    expect(parsed?.tables[0].seats.map((s) => s.taken)).toEqual([true, false]);
    expect(parsed?.tables[1].status).toBe("free");
  });

  it("devuelve null si el restaurante no permite elegir a mano", () => {
    expect(parseTablesForJoin(null)).toBeNull();
  });
});
