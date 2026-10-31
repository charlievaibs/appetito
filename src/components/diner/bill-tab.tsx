"use client";

import { useState } from "react";
import { cancelPayment, requestPayment } from "@/lib/diner-api";
import type { OrderItem, Payment, PaymentItem } from "@/lib/db";
import { isOwnItem } from "@/lib/order-items";
import {
  billTotals,
  coverage,
  needsReference,
  PAYMENT_METHOD_LABEL,
  payableRows,
  selectionTotal,
  type PaymentMethod,
} from "@/lib/payments";
import { usePricing } from "@/lib/pricing";

type Props = {
  sessionId: string;
  userId: string;
  seatId: string | null;
  items: OrderItem[];
  payments: Payment[];
  paymentItems: PaymentItem[];
  methods: PaymentMethod[];
  instructions: string | null;
  onChanged: () => Promise<void>;
};

/**
 * Cuenta de la mesa: cuánto se debe, qué está pagado y cómo pagar. El comensal elige qué paga (lo suyo,
 * toda la mesa o platos concretos) y con qué método; el mesero o caja lo confirma. La app no cobra:
 * deja constancia de quién paga qué para que la cuenta se reparta sin discusiones.
 */
export function BillTab({ sessionId, userId, seatId, items, payments, paymentItems, methods, instructions, onChanged }: Props) {
  const { format, vatPercent } = usePricing();
  const rows = coverage(items, paymentItems, payments, vatPercent);
  const totals = billTotals(rows);
  const payable = payableRows(rows);

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenMethod = method || methods[0] || null;
  const toPay = selectionTotal(rows, selected);
  const mine = payments.filter((p) => p.created_by === userId && (p.status === "pending" || p.status === "confirmed"));

  function choose(ids: string[]) {
    setSelected(new Set(ids));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit() {
    if (!chosenMethod || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await requestPayment(sessionId, [...selected], chosenMethod, {
        reference: needsReference(chosenMethod) ? reference : undefined,
        payerName: payerName || undefined,
      });
      setSelected(new Set());
      setReference("");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo avisar del pago.");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-muted">Todavía no hay nada en la cuenta de esta mesa.</p>;
  }

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
        <Stat label="Total de la mesa" value={format(totals.total)} />
        <Stat label="Pagado" value={format(totals.paid)} />
        <Stat label="Por confirmar" value={format(totals.pending)} />
        <Stat label="Falta pagar" value={format(totals.remaining)} strong />
      </dl>

      {vatPercent > 0 && (
        <p className="mt-2 text-xs text-muted">
          Incluye IVA ({vatPercent}%): subtotal {format(Math.round((totals.total * 100) / (100 + vatPercent)))} + IVA{" "}
          {format(totals.total - Math.round((totals.total * 100) / (100 + vatPercent)))}.
        </p>
      )}

      {totals.remaining === 0 && totals.pending === 0 && (
        <p role="status" className="mt-3 rounded-xl bg-green-500/15 px-4 py-3 text-sm font-medium text-green-600">
          ✓ La cuenta está pagada. ¡Gracias!
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2" aria-label="Platos de la cuenta">
        {rows.map((r) => {
          const state = r.remaining === 0 ? (r.pending > 0 ? "Por confirmar" : "Pagado") : r.paid + r.pending > 0 ? "Pago parcial" : "Pendiente";
          return (
            <li key={r.item.id}>
              <label className={`flex items-start gap-3 rounded-xl border border-line bg-card px-3 py-2 ${r.remaining > 0 ? "cursor-pointer" : "opacity-70"}`}>
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={r.remaining === 0}
                  checked={selected.has(r.item.id)}
                  onChange={() => toggle(r.item.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {r.item.quantity}× {r.item.dish_name}
                  </span>
                  <span className="block text-xs text-muted">
                    {[r.item.for_name, r.item.seat_label].filter(Boolean).join(" · ") || "Mesa"}
                  </span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-semibold">{format(r.total)}</span>
                  <span className={`block text-xs ${r.remaining === 0 ? "text-green-600" : "text-muted"}`}>{state}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {payable.length > 0 && (
        <section className="mt-4 rounded-2xl border border-line bg-card p-4" aria-label="Pagar">
          <div className="flex flex-wrap gap-2">
            <QuickButton onClick={() => choose(payable.filter((r) => isOwnItem(r.item, userId, seatId)).map((r) => r.item.id))}>
              Mis platos
            </QuickButton>
            <QuickButton onClick={() => choose(payable.map((r) => r.item.id))}>Toda la mesa</QuickButton>
            <QuickButton onClick={() => choose([])}>Ninguno</QuickButton>
          </div>

          {methods.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Este restaurante cobra en la mesa: pídele la cuenta a tu mesero.</p>
          ) : (
            <>
              <label htmlFor="pay-method" className="mt-4 block text-sm font-medium">
                ¿Cómo vas a pagar?
              </label>
              <select
                id="pay-method"
                value={chosenMethod ?? ""}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-background px-3"
              >
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>

              {instructions && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-tomato/10 px-3 py-2 text-sm">{instructions}</p>
              )}

              {chosenMethod && needsReference(chosenMethod) && (
                <>
                  <label htmlFor="pay-ref" className="mt-3 block text-sm font-medium">
                    Número de referencia (cuando ya hayas pagado)
                  </label>
                  <input
                    id="pay-ref"
                    maxLength={60}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-line bg-background px-3"
                  />
                </>
              )}

              <label htmlFor="pay-name" className="mt-3 block text-sm font-medium">
                Tu nombre (opcional)
              </label>
              <input
                id="pay-name"
                maxLength={60}
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-background px-3"
              />

              {error && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void submit()}
                className="mt-4 h-12 w-full rounded-full bg-tomato font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
              >
                {selected.size === 0 ? "Elige qué vas a pagar" : `Voy a pagar ${format(toPay)}`}
              </button>
              <p className="mt-2 text-xs text-muted">
                Appetito no cobra: avisa a tu mesero de lo que pagarás y él lo confirma cuando lo reciba.
              </p>
            </>
          )}
        </section>
      )}

      {mine.length > 0 && (
        <section className="mt-4" aria-label="Mis pagos">
          <h3 className="mb-2 font-semibold">Mis pagos</h3>
          <ul className="flex flex-col gap-2">
            {mine.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm">
                <span>
                  {format(p.amount_usd_cents)} · {PAYMENT_METHOD_LABEL[p.method as PaymentMethod] ?? p.method}
                  <span className="block text-xs text-muted">{p.status === "confirmed" ? "Confirmado" : "Esperando confirmación"}</span>
                </span>
                {p.status === "pending" && (
                  <button
                    type="button"
                    className="text-xs text-red-600 underline"
                    onClick={() => void cancelPayment(p.id).then(onChanged)}
                  >
                    Retirar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={strong ? "text-lg font-bold text-tomato" : "font-semibold"}>{value}</dd>
    </div>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-9 rounded-full border border-line bg-background px-4 text-sm font-medium hover:bg-line">
      {children}
    </button>
  );
}
