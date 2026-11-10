import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildSheet, checkImportRow, importRowKey, parseImportTable, templateSheet } from "./columns";
import { parseCsv, toCsv } from "./csv";
import { readXlsx, writeXlsx } from "./xlsx";

describe("parseCsv", () => {
  it("lee coma, punto y coma y tabulador", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("respeta comillas, comillas dobles y saltos dentro de la celda", () => {
    expect(parseCsv('a;b\n"x;y";"di ""hola""\nlinea2"')).toEqual([["a", "b"], ["x;y", 'di "hola"\nlinea2']]);
  });

  it("quita el BOM, acepta CRLF y descarta filas vacías", () => {
    expect(parseCsv("﻿a;b\r\n\r\n1;2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("ida y vuelta con tildes y comillas", () => {
    const rows = [["nombre", "nota"], ["Café", 'con "azúcar"; y más']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("neutraliza fórmulas al exportar pero no los números", () => {
    const csv = toCsv([["=1+1", -5]]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain(";-5");
  });
});

describe("xlsx", () => {
  it("ida y vuelta de texto, números, tildes y caracteres XML", () => {
    const rows = [
      ["nombre", "precio", "nota"],
      ["Café <especial> & más", 2.5, "ñandú"],
    ];
    expect(readXlsx(writeXlsx(rows))).toEqual([
      ["nombre", "precio", "nota"],
      ["Café <especial> & más", "2.5", "ñandú"],
    ]);
  });

  it("lee cadenas compartidas y celdas saltadas", () => {
    const xml = (s: string) => '<?xml version="1.0"?>' + s;
    const bytes = zipSync({
      "xl/sharedStrings.xml": strToU8(xml('<sst><si><t>nombre</t></si><si><r><t>Pa</t></r><r><t>n</t></r></si></sst>')),
      "xl/worksheets/sheet1.xml": strToU8(
        xml(
          '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>7</v></c></row>' +
            '<row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>',
        ),
      ),
    });
    expect(readXlsx(bytes)).toEqual([["nombre", "", "7"], ["Pan"]]);
  });

  it("rechaza archivos que no son Excel", () => {
    expect(() => readXlsx(strToU8("esto no es un zip"))).toThrow(/Excel/);
  });

  it("rechaza archivos enormes", () => {
    expect(() => readXlsx(new Uint8Array(11 * 1024 * 1024))).toThrow(/grande/);
  });
});

describe("parseImportTable", () => {
  it("reconoce encabezados en español con tildes y alias, e ignora columnas desconocidas", () => {
    const parsed = parseImportTable("menu", [
      ["Código", "Nombre", "Categoría", "Precio (sin IVA)", "Color"],
      ["hamb", "Hamburguesa", "Platos", "8,50", "rojo"],
    ]);
    expect(parsed.fatal).toBeNull();
    expect(parsed.ignoredColumns).toEqual(["Color"]);
    expect(parsed.rows).toEqual([{ code: "hamb", name: "Hamburguesa", category: "Platos", price: "8,50" }]);
  });

  it("deja fuera las celdas vacías para no pisar datos", () => {
    const parsed = parseImportTable("inventory", [["sku", "stock", "costo"], ["pan", "", "1.5"]]);
    expect(parsed.rows).toEqual([{ sku: "pan", cost: "1.5" }]);
  });

  it("exige una columna para identificar filas", () => {
    expect(parseImportTable("menu", [["precio"], ["3"]]).fatal).toMatch(/identificar/);
    expect(parseImportTable("menu", [["nombre"]]).fatal).toMatch(/sin filas|no tiene filas/);
  });

  it("limita las filas", () => {
    const table = [["nombre"], ...Array.from({ length: 2001 }, (_, i) => [`p${i}`])];
    expect(parseImportTable("menu", table).fatal).toMatch(/Demasiadas/);
  });
});

describe("checkImportRow / importRowKey", () => {
  it("valida números, sí/no y la identificación", () => {
    expect(checkImportRow("menu", { name: "A", price: "12,5" })).toBeNull();
    expect(checkImportRow("menu", { name: "A", price: "doce" })).toMatch(/número/);
    expect(checkImportRow("menu", { name: "A", available: "quizá" })).toMatch(/sí o no/);
    expect(checkImportRow("inventory", { stock: "3" })).toMatch(/Falta/);
  });

  it("usa el código y, si falta, el nombre", () => {
    expect(importRowKey("menu", { code: "Hamb-1", name: "X" })).toBe("hamb-1");
    expect(importRowKey("menu", { name: "Café Ñandú" })).toBe("cafe-nandu");
  });
});

describe("plantillas", () => {
  it("cada fila de ejemplo tiene tantas celdas como encabezados y se lee de vuelta", () => {
    for (const kind of ["menu", "inventory"] as const) {
      const sheet = templateSheet(kind);
      for (const row of sheet) expect(row).toHaveLength(sheet[0].length);
      const parsed = parseImportTable(kind, parseCsv(toCsv(sheet)));
      expect(parsed.fatal).toBeNull();
      expect(parsed.ignoredColumns).toEqual([]);
      expect(parsed.rows.every((r) => checkImportRow(kind, r) === null)).toBe(true);
    }
    expect(buildSheet("menu", [])).toHaveLength(1);
  });
});
