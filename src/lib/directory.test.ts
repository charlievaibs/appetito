import { describe, expect, it } from "vitest";
import { parseDirectory } from "./directory";

describe("parseDirectory", () => {
  it("convierte la respuesta del servidor", () => {
    const [r] = parseDirectory([
      {
        id: "1",
        name: "Demo",
        slug: "demo",
        description: "Rico",
        city: "Caracas",
        address: null,
        ordering_mode: "qr",
        distance_m: 120,
      },
    ]);
    expect(r).toMatchObject({ name: "Demo", city: "Caracas", address: null, distanceMeters: 120, orderingMode: "qr" });
  });

  it("deja la distancia en null cuando no se conoce", () => {
    const [r] = parseDirectory([{ id: "1", name: "Demo", slug: "demo", distance_m: null }]);
    expect(r.distanceMeters).toBeNull();
  });

  it("descarta entradas mal formadas y respuestas que no son una lista", () => {
    expect(parseDirectory([{ name: "sin id" }, "x", null])).toEqual([]);
    expect(parseDirectory({ a: 1 })).toEqual([]);
  });
});
