import { describe, expect, it } from "vitest";
import { describeError } from "./errors";

describe("describeError", () => {
  it("traduce los códigos de la base de datos", () => {
    expect(describeError("not_editable")).toContain("preparación");
    expect(describeError("P0001: invalid_tag")).toContain("QR");
    expect(describeError("diner_ordering_disabled")).toContain("mesero");
  });

  it("explica que el acceso como invitado puede estar desactivado", () => {
    expect(describeError("Anonymous sign-ins are disabled")).toContain("invitado");
  });

  it("explica los fallos de red", () => {
    expect(describeError("TypeError: Failed to fetch")).toContain("conexión");
  });

  it("deja pasar los mensajes desconocidos", () => {
    expect(describeError("algo raro")).toBe("algo raro");
  });
});
