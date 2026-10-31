import { describe, expect, it } from "vitest";
import { parseSessionContext } from "./diner-api";

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
