import { describe, expect, it } from "vitest";
import { parseTagAction, tagUrl } from "./tags";

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
