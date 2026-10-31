import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(slugify("Café Ñandú")).toBe("cafe-nandu");
  });

  it("une palabras con guiones y limpia los bordes", () => {
    expect(slugify("  La   Casa  del Sabor!! ")).toBe("la-casa-del-sabor");
  });

  it("devuelve vacío si no hay caracteres válidos", () => {
    expect(slugify("¡¿?!")).toBe("");
  });

  it("limita la longitud sin dejar un guion al final", () => {
    const slug = slugify("a".repeat(49) + " bbbb");
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });
});
