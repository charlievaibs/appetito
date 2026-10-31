import { describe, expect, it } from "vitest";
import { inviteUrl, parseTagAction, parseTagLink, tagUrl } from "./tags";

describe("parseTagLink", () => {
  const token = "0123456789abcdef0123456789abcdef";

  it("lee la dirección de una etiqueta", () => {
    expect(parseTagLink(`https://getappetito.vercel.app/m/${token}`)).toEqual({ token, action: null });
    expect(parseTagLink(` https://x.app/m/${token}?a=cuenta `)).toEqual({ token, action: "bill" });
  });

  it("acepta el código suelto", () => {
    expect(parseTagLink(token)).toEqual({ token, action: null });
  });

  it("descarta lo que no es una etiqueta", () => {
    expect(parseTagLink("https://example.com/otra/ruta")).toBeNull();
    expect(parseTagLink("hola")).toBeNull();
    expect(parseTagLink("")).toBeNull();
  });
});

describe("tagUrl", () => {
  it("apunta a la mesa o puesto sin acción", () => {
    expect(tagUrl("https://x.app", "abc123")).toBe("https://x.app/m/abc123");
  });

  it("añade la acción de servicio", () => {
    expect(tagUrl("https://x.app", "abc", "waiter")).toBe("https://x.app/m/abc?a=mesero");
    expect(tagUrl("https://x.app", "abc", "bill")).toBe("https://x.app/m/abc?a=cuenta");
  });
});

describe("parseTagAction", () => {
  it("reconoce las acciones", () => {
    expect(parseTagAction("?a=mesero")).toBe("waiter");
    expect(parseTagAction("?a=cuenta")).toBe("bill");
  });

  it("ignora lo que no conoce", () => {
    expect(parseTagAction("")).toBeNull();
    expect(parseTagAction("?a=otra")).toBeNull();
    expect(parseTagAction("?b=mesero")).toBeNull();
  });
});

describe("inviteUrl", () => {
  it("apunta a la ruta de invitaciones", () => {
    expect(inviteUrl("https://x.app", "abc123")).toBe("https://x.app/i/abc123");
  });
});
