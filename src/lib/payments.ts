/**
 * Cuenta de la mesa y cobros. Funciones puras (sin red ni navegador) que replican lo que hace la base
 * de datos (`private.items_remaining`): el total de cada plato menos lo cubierto por pagos
 * pendientes o confirmados. La base de datos es la que decide de verdad; esto da respuesta inmediata.
 *
 * Appetito no procesa dinero: registra quién paga qué y con qué método, y el personal lo confirma.
 */
import type { OrderItem, Payment, PaymentItem } from "./db";

export const PAYMENT_METHODS = ["cash", "pago_movil", "card_pos", "transfer", "zelle", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  pago_movil: "Pago móvil",
  card_pos: "Punto de venta (tarjeta)",
  transfer: "Transferencia",
  zelle: "Zelle",
  other: "Otro",
};

/** Métodos que dejan una referencia (número de operación) que el personal puede verificar. */
export function needsReference(method: PaymentMethod): boolean {
  return method === "pago_movil" || method === "transfer" || method === "zelle";
}

/** Lee la lista de métodos aceptados que devuelve la base de datos; descarta valores desconocidos. */
export function parsePaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  return PAYMENT_METHODS.filter((m) => value.includes(m));
}

/** Estado de pago de un plato. */
export type ItemCoverage = {
  item: OrderItem;
  /** Total de la línea (con IVA) en céntimos de la moneda base. */
  total: number;
  /** Cubierto por pagos confirmados. */
  paid: number;
  /** Cubierto por pagos que esperan confirmación. */
  pending: number;
  /** Lo que aún nadie ha pagado ni pedido pagar. */
  remaining: number;
};

/** Cuánto está pagado, en espera y pendiente de cada plato (los cancelados no cuentan). */
export function coverage(
  items: OrderItem[],
  paymentItems: Pick<PaymentItem, "item_id" | "payment_id" | "amount_usd_cents">[],
  payments: Pick<Payment, "id" | "status">[],
  vatPercent = 0,
): ItemCoverage[] {
  const status = new Map(payments.map((p) => [p.id, p.status]));
  return items
    .filter((i) => i.status !== "cancelled")
    .map((item) => {
      // Con IVA, por línea y redondeado al céntimo, igual que lo calcula la base de datos.
      const total = Math.round((item.unit_price_cents * item.quantity * (100 + vatPercent)) / 100);
      let paid = 0;
      let pending = 0;
      for (const pi of paymentItems) {
        if (pi.item_id !== item.id) continue;
        const s = status.get(pi.payment_id);
        if (s === "confirmed") paid += pi.amount_usd_cents;
        else if (s === "pending") pending += pi.amount_usd_cents;
      }
      return { item, total, paid, pending, remaining: Math.max(0, total - paid - pending) };
    });
}

/** Totales de la cuenta de una mesa. */
export function billTotals(rows: ItemCoverage[]) {
  return rows.reduce(
    (sum, r) => ({
      total: sum.total + r.total,
      paid: sum.paid + r.paid,
      pending: sum.pending + r.pending,
      remaining: sum.remaining + r.remaining,
    }),
    { total: 0, paid: 0, pending: 0, remaining: 0 },
  );
}

/** La mesa está saldada si ya no queda nada por cubrir ni esperando confirmación. */
export function isSettled(rows: ItemCoverage[]): boolean {
  const { total, remaining, pending } = billTotals(rows);
  return total > 0 && remaining === 0 && pending === 0;
}

/** Platos que se pueden pagar ahora (les queda algo por cubrir). */
export function payableRows(rows: ItemCoverage[]): ItemCoverage[] {
  return rows.filter((r) => r.remaining > 0);
}

/** Cuánto suma pagar estos platos (céntimos de dólar), a partir de lo que les queda. */
export function selectionTotal(rows: ItemCoverage[], selectedIds: ReadonlySet<string>): number {
  return rows.filter((r) => selectedIds.has(r.item.id)).reduce((sum, r) => sum + r.remaining, 0);
}

/** Métodos aceptados e instrucciones de pago del local, tal como los devuelve `restaurant_pricing`. */
export function parsePaymentInfo(json: unknown): { methods: PaymentMethod[]; instructions: string | null } {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return { methods: [], instructions: null };
  const { payment_methods, payment_instructions } = json as Record<string, unknown>;
  return {
    methods: parsePaymentMethods(payment_methods),
    instructions: typeof payment_instructions === "string" && payment_instructions.trim() ? payment_instructions : null,
  };
}
