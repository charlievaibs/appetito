import { describe, expect, it, vi } from "vitest";
import { closeTable, isBalanceError } from "./close-table";

const ok = { error: null };
const fail = (message: string) => ({ error: { message } });

describe("closeTable", () => {
  it("cierra una mesa saldada sin preguntar", async () => {
    const rpc = vi.fn().mockResolvedValue(ok);
    const confirmForce = vi.fn(() => true);
    expect(await closeTable(rpc, "s1", { canForce: true, confirmForce })).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(confirmForce).not.toHaveBeenCalled();
  });

  it("con saldo, quien no puede forzar recibe el aviso y no se fuerza nada", async () => {
    const rpc = vi.fn().mockResolvedValue(fail("unpaid_balance"));
    const message = await closeTable(rpc, "s1", { canForce: false, confirmForce: () => true });
    expect(message).toContain("saldo");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("con saldo, caja puede forzar el cierre tras confirmar", async () => {
    const rpc = vi.fn().mockResolvedValueOnce(fail("unpaid_balance")).mockResolvedValueOnce(ok);
    expect(await closeTable(rpc, "s1", { canForce: true, confirmForce: () => true })).toBeNull();
    expect(rpc).toHaveBeenLastCalledWith("close_session", { p_session_id: "s1", p_force: true });
  });

  it("si caja no confirma, la mesa sigue abierta", async () => {
    const rpc = vi.fn().mockResolvedValue(fail("payments_pending"));
    expect(await closeTable(rpc, "s1", { canForce: true, confirmForce: () => false })).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("otros errores se explican sin intentar forzar", async () => {
    const rpc = vi.fn().mockResolvedValue(fail("forbidden"));
    expect(await closeTable(rpc, "s1", { canForce: true, confirmForce: () => true })).toContain("permiso");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("isBalanceError", () => {
  it("reconoce los errores de saldo", () => {
    expect(isBalanceError("P0001: unpaid_balance")).toBe(true);
    expect(isBalanceError("payments_pending")).toBe(true);
    expect(isBalanceError("forbidden")).toBe(false);
  });
});
