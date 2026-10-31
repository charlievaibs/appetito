import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./money-input";

describe("parseMoneyInput", () => {
  it("lee enteros y decimales con punto o coma", () => {
    expect(parseMoneyInput("20")).toBe(2000);
    expect(parseMoneyInput("20,5")).toBe(2050);
    expect(parseMoneyInput("20.50")).toBe(2050);
    expect(parseMoneyInput(" 7,99 ")).toBe(799);
  });

  it("entiende los separadores de miles", () => {
    expect(parseMoneyInput("1.250,75")).toBe(125075);
    expect(parseMoneyInput("1,250.75")).toBe(125075);
    expect(parseMoneyInput("1.250")).toBe(125000);
    expect(parseMoneyInput("11.555,58")).toBe(1155558);
  });

  it("rechaza lo que no es un importe", () => {
    for (const bad of ["", "abc", "-5", "0", "0,00", "12abc", "1e5"]) expect(parseMoneyInput(bad)).toBeNull();
  });
});
