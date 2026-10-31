"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmPayment, staffRecordPayment } from "@/lib/diner-api";
import type { OrderItem, Payment, PaymentItem, ServiceRequest, TableSession } from "@/lib/db";
import { parsePaymentMethods, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, billTotals, coverage, needsReference, payableRows, selectionTotal, type PaymentMethod } from "@/lib/payments";
import { usePricing } from "@/lib/pricing";
import { closeTable } from "@/lib/close-table";
import { parseMoneyInput } from "@/lib/money-input";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { canCloseTable, canForceClose } from "@/lib/roles";
import { toVesCents, vesFor } from "@/lib/rates";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, smallButton } from "./styles";

type Session = TableSession & { order_items: OrderItem[] };
type CajaData = { sessions: Session[]; payments: Payment[]; paymentItems: PaymentItem[]; billCalls: ServiceRequest[] };

const METHOD_LABEL = (m: string) => PAYMENT_METHOD_LABEL[m as PaymentMethod] ?? m;

/**
 * Caja: confirmar los pagos que avisan los comensales, cobrar una mesa (todo o platos concretos, en dólares
 * o en bolívares a la tasa del día) y ver lo cobrado hoy. Appetito registra; el dinero se maneja como siempre.
 */
export function CajaBoard() {
  const restaurant = useRestaurant();
  const { format, rate } = usePricing();
  const { role } = usePanel();
  const methods = parsePaymentMethods(restaurant.payment_methods);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const loader = useCallback(async (): Promise<CajaData> => {
    const supabase = getSupabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [sessions, payments, paymentItems, billCalls] = await Promise.all([
      supabase.from("table_sessions").select("*, order_items(*)").eq("restaurant_id", restaurant.id).eq("status", "open").order("opened_at"),
      supabase.from("payments").select("*").eq("restaurant_id", restaurant.id).gte("created_at", startOfDay.toISOString()).order("created_at"),
      supabase.from("payment_items").select("*, payments!inner(restaurant_id, status)").eq("payments.restaurant_id", restaurant.id).in("payments.status", ["pending", "confirmed"]),
      supabase.from("service_requests").select("*").eq("restaurant_id", restaurant.id).eq("kind", "bill").is("resolved_at", null),
    ]);
    return {
      sessions: unwrap(sessions) as Session[],
      payments: unwrap(payments),
      billCalls: unwrap(billCalls),
      paymentItems: unwrap(paymentItems).map(({ payment_id, item_id, session_id, amount_usd_cents }) => ({ payment_id, item_id, session_id, amount_usd_cents })),
    };
  }, [restaurant.id]);
  const { data, error: loadError, reload } = useAsyncLoad(loader);

  useEffect(() => {
    const supabase = getSupabase();
    const filter = `restaurant_id=eq.${restaurant.id}`;
    const channel = supabase
      .channel(`caja-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter }, () => void reload())
      .subscribe();
    const backup = setInterval(() => void reload(), 30_000);
    return () => {
      clearInterval(backup);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload]);

  /** Ejecuta una operación de cobro, muestra el error en español y recarga. */
  async function run(action: Promise<unknown>) {
    try {
      await action;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    }
    await reload();
  }

  if (!data && !(error ?? loadError)) return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  const { sessions, payments, paymentItems, billCalls } = data ?? { sessions: [], payments: [], paymentItems: [], billCalls: [] };

  const pending = payments.filter((p) => p.status === "pending");
  const confirmedToday = payments.filter((p) => p.status === "confirmed");
  const label = (sessionId: string) => sessions.find((s) => s.id === sessionId)?.table_label ?? "Mesa";

  // Resumen del día: lo cobrado por método, en dólares y en lo que realmente se recibió.
  const byMethod = new Map<string, { usd: number; ves: number }>();
  for (const p of confirmedToday) {
    const row = byMethod.get(p.method) ?? { usd: 0, ves: 0 };
    row.usd += p.amount_usd_cents;
    if (p.currency === "VES") row.ves += p.amount_paid_cents;
    byMethod.set(p.method, row);
  }
  const totalToday = confirmedToday.reduce((sum, p) => sum + p.amount_usd_cents, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
        <p className="text-xs text-muted">Se actualiza en vivo</p>
      </div>
      {(error ?? loadError) && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error ?? loadError}
        </p>
      )}

      <section className={`${cardClass} mb-4`} aria-label="Cobrado hoy">
        <h2 className="font-semibold">Cobrado hoy: {format(totalToday)}</h2>
        {byMethod.size === 0 ? (
          <p className="mt-1 text-sm text-muted">Todavía no hay cobros confirmados hoy.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {[...byMethod.entries()].map(([method, v]) => (
              <li key={method} className="rounded-full bg-line px-3 py-1">
                {METHOD_LABEL(method)}: {format(v.usd)}
                {v.ves > 0 && <span className="text-muted"> · recibido Bs {(v.ves / 100).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section className="mb-4 flex flex-col gap-2" aria-label="Pagos por confirmar">
          <h2 className="font-semibold">Pagos por confirmar ({pending.length})</h2>
          {pending.map((p) => (
            <PendingPayment key={p.id} payment={p} table={label(p.session_id)} rate={rate} run={run} />
          ))}
        </section>
      )}

      <h2 className="mb-2 font-semibold">Mesas abiertas</h2>
      {sessions.length === 0 && <p className="py-6 text-center text-muted">No hay mesas abiertas.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((s) => {
          const rows = coverage(s.order_items, paymentItems.filter((pi) => pi.session_id === s.id), payments.filter((p) => p.session_id === s.id));
          const totals = billTotals(rows);
          const open = openId === s.id;
          const askedBill = billCalls.some((c) => c.session_id === s.id);
          const settled = totals.remaining === 0 && totals.pending === 0;
          const mayClose = canCloseTable(role, restaurant.table_close as "cashier" | "staff");
          return (
            <article key={s.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">
                    {s.table_label}
                    {askedBill && <span className="ml-2 rounded-full bg-tomato px-2 py-0.5 text-xs font-medium text-white">🧾 pidió la cuenta</span>}
                  </h3>
                  <p className="text-sm text-muted">
                    Total {format(totals.total)} · pagado {format(totals.paid)}
                    {totals.pending > 0 && ` · por confirmar ${format(totals.pending)}`}
                  </p>
                </div>
                <p className={`text-lg font-bold ${totals.remaining > 0 ? "text-tomato" : "text-green-600"}`}>
                  {totals.remaining > 0 ? format(totals.remaining) : "Saldada"}
                </p>
              </div>
              {payableRows(rows).length > 0 && methods.length > 0 && (
                <button type="button" className={`${smallButton} mt-3`} onClick={() => setOpenId(open ? null : s.id)}>
                  {open ? "Cerrar cobro" : "Cobrar"}
                </button>
              )}
              {mayClose && (
                <button
                  type="button"
                  className={`${smallButton} ml-2 mt-3 ${settled ? "" : "text-red-600"}`}
                  onClick={() =>
                    void run(
                      closeTable((name, args) => getSupabase().rpc(name, args), s.id, {
                        canForce: canForceClose(role),
                        confirmForce: () =>
                          window.confirm(`${s.table_label} todavía tiene ${format(totals.remaining + totals.pending)} sin cobrar. ¿Cerrarla igualmente? Quedará anotado como deuda.`),
                      }).then((message) => {
                        if (message) throw new Error(message);
                      }),
                    )
                  }
                >
                  {settled ? "Cerrar mesa" : "Cerrar con deuda"}
                </button>
              )}
              {open && <ChargeForm session={s} rows={rows} methods={methods} rate={rate} run={run} onDone={() => setOpenId(null)} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Un pago que avisó un comensal: se confirma indicando cómo se recibió de verdad, o se rechaza. */
function PendingPayment({ payment, table, rate, run }: { payment: Payment; table: string; rate: number | null; run: (a: Promise<unknown>) => Promise<void> }) {
  const { format } = usePricing();
  const [method, setMethod] = useState(payment.method as PaymentMethod);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [reference, setReference] = useState(payment.reference ?? "");
  const [received, setReceived] = useState("");
  const bs = vesFor(payment.amount_usd_cents, rate);
  const due = currency === "VES" && rate !== null ? toVesCents(payment.amount_usd_cents, rate) : payment.amount_usd_cents;
  const cash = method === "cash" ? cashChange(received, due) : null;

  return (
    <div className="rounded-2xl border border-tomato/50 bg-tomato/10 px-4 py-3">
      <p className="font-semibold">
        💵 {table}: {format(payment.amount_usd_cents)}
        {payment.payer_name ? ` · ${payment.payer_name}` : ""}
      </p>
      <p className="text-xs text-muted">
        Dice que paga con {METHOD_LABEL(payment.method)}
        {payment.reference ? ` · ref. ${payment.reference}` : ""}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select aria-label="Método recibido" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="h-9 rounded-xl border border-line bg-background px-2 text-sm">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
        <select aria-label="Moneda recibida" value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "VES")} className="h-9 rounded-xl border border-line bg-background px-2 text-sm">
          <option value="USD">Recibido en dólares</option>
          <option value="VES" disabled={rate === null}>
            Recibido en bolívares{bs ? ` (${bs})` : ""}
          </option>
        </select>
        {needsReference(method) && (
          <input aria-label="Referencia" placeholder="Referencia" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 rounded-xl border border-line bg-background px-3 text-sm" />
        )}
        {method === "cash" && <CashFields currency={currency} due={due} value={received} onChange={setReceived} />}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-full bg-tomato px-3 text-xs font-semibold text-white hover:bg-tomato-dark"
          disabled={cash !== null && cash.short}
          onClick={() =>
            void run(
              confirmPayment(payment.id, true, {
                method,
                reference,
                currency,
                rate: currency === "VES" ? (rate ?? undefined) : undefined,
                received: cash?.received ?? undefined,
              }),
            )
          }
        >
          Confirmar pago
        </button>
        <button type="button" className={smallButton} onClick={() => void run(confirmPayment(payment.id, false))}>
          Rechazar
        </button>
      </div>
    </div>
  );
}

/** Cobro directo de una mesa: platos, método, moneda (con la tasa del día) y referencia. */
function ChargeForm({
  session,
  rows,
  methods,
  rate,
  run,
  onDone,
}: {
  session: Session;
  rows: ReturnType<typeof coverage>;
  methods: PaymentMethod[];
  rate: number | null;
  run: (a: Promise<unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const { format } = usePricing();
  const payable = payableRows(rows);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(payable.map((r) => r.item.id)));
  const [method, setMethod] = useState<PaymentMethod>(methods[0]);
  const [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [reference, setReference] = useState("");
  const [payer, setPayer] = useState("");
  const [received, setReceived] = useState("");
  const total = selectionTotal(rows, selected);
  const bs = vesFor(total, rate);
  const due = currency === "VES" && rate !== null ? toVesCents(total, rate) : total;
  const cash = method === "cash" ? cashChange(received, due) : null;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-background p-3">
      <ul className="flex flex-col gap-1">
        {payable.map((r) => (
          <li key={r.item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(r.item.id)} onChange={() => toggle(r.item.id)} />
              <span className="flex-1">
                {r.item.quantity}× {r.item.dish_name}
                <span className="text-xs text-muted"> {[r.item.for_name, r.item.seat_label].filter(Boolean).join(" · ")}</span>
              </span>
              <span>{format(r.remaining)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select aria-label="Método" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={`${inputClass} h-10`}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
        <select aria-label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "VES")} className={`${inputClass} h-10`}>
          <option value="USD">En dólares</option>
          <option value="VES" disabled={rate === null}>
            En bolívares{bs ? ` (${bs})` : " (sin tasa)"}
          </option>
        </select>
        {needsReference(method) && (
          <input aria-label="Referencia" placeholder="Referencia" value={reference} onChange={(e) => setReference(e.target.value)} className={`${inputClass} h-10`} />
        )}
        <input aria-label="Quién paga" placeholder="Quién paga (opcional)" value={payer} onChange={(e) => setPayer(e.target.value)} className={`${inputClass} h-10`} />
        {method === "cash" && <CashFields currency={currency} due={due} value={received} onChange={setReceived} />}
      </div>
      <button
        type="button"
        disabled={selected.size === 0 || total === 0 || (cash !== null && cash.short)}
        className="mt-3 h-11 w-full rounded-full bg-tomato font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
        onClick={() =>
          void run(
            staffRecordPayment(session.id, [...selected], method, {
              reference: needsReference(method) ? reference : undefined,
              payerName: payer || undefined,
              currency,
              rate: currency === "VES" ? (rate ?? undefined) : undefined,
              received: cash?.received ?? undefined,
            }).then(onDone),
          )
        }
      >
        Registrar cobro de {format(total)}
        {currency === "VES" && bs ? ` · ${bs}` : ""}
      </button>
    </div>
  );
}

/** Efectivo recibido y vuelto. `received` va en céntimos de la moneda del cobro; `short` indica que no alcanza. */
function cashChange(input: string, due: number): { received: number | null; change: number; short: boolean } | null {
  if (input.trim() === "") return { received: null, change: 0, short: false };
  const received = parseMoneyInput(input);
  if (received === null) return { received: null, change: 0, short: true };
  return { received, change: received - due, short: received < due };
}

/** Campo «efectivo recibido» con el vuelto a entregar, para no equivocarse al dar el cambio. */
function CashFields({ currency, due, value, onChange }: { currency: "USD" | "VES"; due: number; value: string; onChange: (v: string) => void }) {
  const { formatIn } = usePricing();
  const cash = cashChange(value, due);
  return (
    <div className="sm:col-span-2">
      <label className="text-xs font-medium">
        Efectivo recibido ({currency === "VES" ? "Bs" : "divisa"}) · a cobrar {formatIn(currency, due)}
        <input
          inputMode="decimal"
          placeholder={`Por ejemplo ${(due / 100).toFixed(2)}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 h-9 w-full rounded-xl border border-line bg-background px-3 text-sm"
        />
      </label>
      {cash && value.trim() !== "" && (
        <p role="status" className={`mt-1 text-sm font-semibold ${cash.short ? "text-red-600" : "text-green-600"}`}>
          {cash.received === null
            ? "Escribe un importe válido."
            : cash.short
              ? `Falta ${formatIn(currency, due - cash.received)}`
              : `Vuelto a entregar: ${formatIn(currency, cash.change)}`}
        </p>
      )}
    </div>
  );
}
