import { describe, expect, it } from "vitest";
import { apiKeyFrom, rowsFrom } from "./api-server";

const req = (authorization?: string) => new Request("https://x.test/api/v1/menu", { headers: authorization ? { authorization } : {} });

describe("apiKeyFrom", () => {
  it("lee Bearer", () => {
    expect(apiKeyFrom(req("Bearer apt_abc"))).toBe("apt_abc");
    expect(apiKeyFrom(req("bearer apt_abc"))).toBe("apt_abc");
  });

  it("lee Basic con la clave como contraseña (Excel) y también sin usuario", () => {
    expect(apiKeyFrom(req(`Basic ${btoa("cualquiera:apt_abc")}`))).toBe("apt_abc");
    expect(apiKeyFrom(req(`Basic ${btoa("apt_abc")}`))).toBe("apt_abc");
    expect(apiKeyFrom(req(`Basic ${btoa("u:con:dos:puntos")}`))).toBe("con:dos:puntos");
  });

  it("ignora lo demás: sin cabecera, esquema raro, Basic mal codificado", () => {
    expect(apiKeyFrom(req())).toBeNull();
    expect(apiKeyFrom(req("Token apt_abc"))).toBeNull();
    expect(apiKeyFrom(req("Basic ¡¡¡"))).toBeNull();
  });

  it("no acepta la clave por la URL", () => {
    const r = new Request("https://x.test/api/v1/menu?key=apt_abc&api_key=apt_abc");
    expect(apiKeyFrom(r)).toBeNull();
  });
});

describe("rowsFrom", () => {
  it("acepta una lista o { rows }", () => {
    expect(rowsFrom([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rowsFrom({ rows: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("rechaza todo lo demás", () => {
    expect(rowsFrom({ rows: "no" })).toBeNull();
    expect(rowsFrom("texto")).toBeNull();
    expect(rowsFrom(null)).toBeNull();
  });
});
