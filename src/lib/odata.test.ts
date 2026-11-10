import { describe, expect, it } from "vitest";
import { ENTITIES, metadataXml, ODataError, runQuery } from "./odata";

const dishes = ENTITIES[0];
const rows = [
  { code: "a", name: "Arepa", category: "Platos", price: 3.5, available: true },
  { code: "b", name: "Batido", category: "Bebidas", price: 2, available: true },
  { code: "c", name: "Cachapa", category: "Platos", price: 6, available: false },
  { code: "d", name: "O'Brien", category: "Platos", price: 9.25, available: true },
];
const q = (query: string) => runQuery(dishes, rows, new URLSearchParams(query));
const codes = (query: string) => q(query).value.map((r) => r.code);

describe("OData $filter", () => {
  it("compara números, textos y booleanos", () => {
    expect(codes("$filter=price gt 3")).toEqual(["a", "c", "d"]);
    expect(codes("$filter=category eq 'Bebidas'")).toEqual(["b"]);
    expect(codes("$filter=available eq false")).toEqual(["c"]);
    expect(codes("$filter=price le 2")).toEqual(["b"]);
  });

  it("combina con and, or, not y paréntesis", () => {
    expect(codes("$filter=category eq 'Platos' and price lt 7")).toEqual(["a", "c"]);
    expect(codes("$filter=(price lt 3 or price gt 9) and available eq true")).toEqual(["b", "d"]);
    expect(codes("$filter=not available")).toEqual(["c"]);
  });

  it("soporta funciones de texto y comillas escapadas", () => {
    expect(codes("$filter=contains(name,'a')")).toEqual(["a", "b", "c"]);
    expect(codes("$filter=startswith(tolower(name),'ba')")).toEqual(["b"]);
    expect(codes("$filter=name eq 'O''Brien'")).toEqual(["d"]);
  });

  it("rechaza campos, funciones y sintaxis desconocidos", () => {
    expect(() => q("$filter=secreto eq 1")).toThrow(ODataError);
    expect(() => q("$filter=eval(name)")).toThrow(ODataError);
    expect(() => q("$filter=price gt")).toThrow(ODataError);
    expect(() => q("$filter=price gt 1 2")).toThrow(ODataError);
    expect(() => q("$filter=name eq 'sin cerrar")).toThrow(ODataError);
    expect(() => q("$filter=" + "(".repeat(50) + "available" + ")".repeat(50))).toThrow(/anidado/);
  });
});

describe("OData otras opciones", () => {
  it("ordena, pagina y cuenta antes de paginar", () => {
    expect(codes("$orderby=price desc&$top=2")).toEqual(["d", "c"]);
    expect(codes("$orderby=category,price desc&$skip=1&$top=2")).toEqual(["d", "c"]);
    expect(q("$filter=category eq 'Platos'&$top=1&$count=true").count).toBe(3);
  });

  it("selecciona campos y rechaza los desconocidos", () => {
    expect(q("$select=code,price&$top=1").value).toEqual([{ code: "a", price: 3.5 }]);
    expect(() => q("$select=password")).toThrow(ODataError);
    expect(() => q("$orderby=nada")).toThrow(ODataError);
    expect(() => q("$top=-1")).toThrow(ODataError);
  });

  it("limita $top y publica el metadato de ambos conjuntos", () => {
    const many = Array.from({ length: 6000 }, (_, i) => ({ code: String(i) }));
    expect(runQuery(dishes, many, new URLSearchParams("$top=999999")).value).toHaveLength(5000);
    const xml = metadataXml();
    expect(xml).toContain('EntitySet Name="Dishes"');
    expect(xml).toContain('EntitySet Name="InventoryItems"');
  });
});
