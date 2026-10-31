/**
 * Cierre de una mesa. La base de datos exige que esté saldada: si queda saldo o hay pagos sin confirmar,
 * rechaza el cierre. Caja, gerente y dueño pueden cerrarla igualmente (cortesía, cliente que se fue…) y
 * entonces la deuda queda anotada en la mesa; mesero y anfitrión deben pasarla por caja.
 */
import { describeError } from "./errors";

type Rpc = (name: "close_session", args: { p_session_id: string; p_force?: boolean }) => PromiseLike<{ error: { message: string } | null }>;

/** ¿El error de cierre se debe a saldo o pagos pendientes (y no a otra cosa)? */
export function isBalanceError(message: string): boolean {
  return message.includes("unpaid_balance") || message.includes("payments_pending");
}

/**
 * Intenta cerrar la mesa. Devuelve un mensaje de error en español, o null si se cerró.
 * `confirmForce` se llama solo si hace falta forzar el cierre y la persona puede hacerlo.
 */
export async function closeTable(
  rpc: Rpc,
  sessionId: string,
  options: { canForce: boolean; confirmForce: () => boolean },
): Promise<string | null> {
  const first = await rpc("close_session", { p_session_id: sessionId });
  if (!first.error) return null;
  if (!isBalanceError(first.error.message)) return describeError(first.error.message);
  if (!options.canForce) return describeError(first.error.message);
  if (!options.confirmForce()) return null;
  const forced = await rpc("close_session", { p_session_id: sessionId, p_force: true });
  return forced.error ? describeError(forced.error.message) : null;
}
