import { describe, expect, it } from "vitest";
import { assignableRoles, can, parseRole, ROLES, canCloseTable, canForceClose } from "./roles";

describe("can", () => {
  it("el dueño y el gerente administran menú, ajustes y equipo", () => {
    for (const role of ["owner", "manager"] as const) {
      expect(can(role, "menu.edit")).toBe(true);
      expect(can(role, "settings.edit")).toBe(true);
      expect(can(role, "team.manage")).toBe(true);
    }
  });

  it("el mesero toma pedidos pero no edita el menú ni el equipo", () => {
    expect(can("waiter", "orders.take")).toBe(true);
    expect(can("waiter", "menu.edit")).toBe(false);
    expect(can("waiter", "team.manage")).toBe(false);
  });

  it("cocina prepara pero no sirve ni toma pedidos", () => {
    expect(can("kitchen", "orders.kitchen")).toBe(true);
    expect(can("kitchen", "orders.serve")).toBe(false);
    expect(can("kitchen", "orders.take")).toBe(false);
  });

  it("caja solo cierra mesas; el anfitrión gestiona mesas", () => {
    expect(can("cashier", "session.close")).toBe(true);
    expect(can("cashier", "orders.take")).toBe(false);
    expect(can("host", "tables.edit")).toBe(true);
    expect(can("host", "orders.kitchen")).toBe(false);
  });

  it("todos ven los pedidos y sin rol no se puede nada", () => {
    for (const role of ROLES) expect(can(role, "orders.view")).toBe(true);
    expect(can(null, "orders.view")).toBe(false);
  });
});

describe("assignableRoles", () => {
  it("el dueño asigna todos; el gerente solo roles de operación; el resto, ninguno", () => {
    expect(assignableRoles("owner")).toHaveLength(ROLES.length);
    expect(assignableRoles("manager")).toEqual(["host", "waiter", "kitchen", "cashier"]);
    expect(assignableRoles("waiter")).toEqual([]);
    expect(assignableRoles(null)).toEqual([]);
  });
});

describe("parseRole", () => {
  it("acepta roles válidos y rechaza el resto", () => {
    expect(parseRole("waiter")).toBe("waiter");
    expect(parseRole("staff")).toBeNull();
    expect(parseRole(5)).toBeNull();
  });
});

describe("cerrar mesas", () => {
  it("en modo caja solo cierran caja, gerente y dueño", () => {
    expect(canCloseTable("cashier", "cashier")).toBe(true);
    expect(canCloseTable("owner", "cashier")).toBe(true);
    expect(canCloseTable("waiter", "cashier")).toBe(false);
    expect(canCloseTable("host", "cashier")).toBe(false);
    expect(canCloseTable("kitchen", "cashier")).toBe(false);
  });

  it("los locales pequeños pueden dejar que cierre el mesero", () => {
    expect(canCloseTable("waiter", "staff")).toBe(true);
    expect(canCloseTable("host", "staff")).toBe(true);
    expect(canCloseTable("kitchen", "staff")).toBe(false);
    expect(canCloseTable(null, "staff")).toBe(false);
  });

  it("solo caja, gerente y dueño cierran con deuda", () => {
    expect(canForceClose("cashier")).toBe(true);
    expect(canForceClose("waiter")).toBe(false);
    expect(canForceClose(null)).toBe(false);
  });
});
