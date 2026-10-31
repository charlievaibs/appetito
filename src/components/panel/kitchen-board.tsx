"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeRequest, ItemStatus, OrderItem, TableSession } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { parseOptions } from "@/lib/order-items";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { can } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { smallButton } from "./styles";

type Ticket = TableSession & { order_items: OrderItem[] };

/** Minutos transcurridos desde una fecha; `now` llega por estado para que el render sea puro. */
function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/**
 * Pantalla de cocina: un ticket por mesa con los platos por preparar. Cocina marca
 * cuándo empieza cada plato; hasta ese momento el comensal puede cambiarlo desde su
 * móvil o con el mesero, y después los cambios pasan por el mesero. Se actualiza en vivo.
 */
export function KitchenBoard() {
  const restaurant = useRestaurant();
  const { role } = usePanel();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const loader = useCallback(async () => {
    const supabase = getSupabase();
    const [sessions, changes] = await Promise.all([
      supabase
        .from("table_sessions")
        .select("*, order_items(*)")
        .eq("restaurant_id", restaurant.id)
        .eq("status", "open")
        .order("opened_at"),
      supabase.from("change_requests").select("*").eq("restaurant_id", restaurant.id).eq("status", "pending"),
    ]);
    return { sessions: unwrap(sessions) as Ticket[], changes: unwrap(changes) as ChangeRequest[] };
  }, [restaurant.id]);
  const { data, error: loadError, reload } = useAsyncLoad(loader);

  // Tiempo real + reloj para los minutos de espera.
  useEffect(() => {
    const supabase = getSupabase();
    const filter = `restaurant_id=eq.${restaurant.id}`;
    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "change_requests", filter }, () => void reload())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "table_sessions", filter }, () => void reload())
      .subscribe();
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const clock = setInterval(tick, 30_000);
    const backup = setInterval(() => void reload(), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(clock);
      clearInterval(backup);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload]);

  async function setStatus(ids: string[], status: ItemStatus) {
    const { error } = await getSupabase().rpc("set_items_status", { p_item_ids: ids, p_status: status });
    setError(error ? describeError(error.message) : null);
    await reload();
  }

  if (!data && !(error ?? loadError)) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  // Solo se muestran mesas con algo por hacer; las más antiguas primero.
  // Una mesa abierta con un escaneo sin personal no llega a cocina hasta que el mesero la confirma.
  const tickets = (data?.sessions ?? [])
    .filter((s) => s.confirmed)
    .map((s) => ({ ...s, todo: s.order_items.filter((i) => i.status === "pending" || i.status === "preparing") }))
    .filter((s) => s.todo.length > 0)
    .sort((a, b) => a.todo[0].created_at.localeCompare(b.todo[0].created_at));
  const canCook = can(role, "orders.kitchen");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Cocina</h1>
        <p className="text-xs text-muted">Se actualiza en vivo</p>
      </div>
      {(error ?? loadError) && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error ?? loadError}
        </p>
      )}
      {tickets.length === 0 && <p className="py-10 text-center text-muted">Todo al día: no hay platos por preparar.</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((t) => {
          const waiting = t.todo.filter((i) => i.status === "pending");
          const wait = waiting.length > 0 ? minutesSince(waiting[0].created_at, now) : null;
          return (
            <article key={t.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold">{t.table_label}</h2>
                {wait !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      wait >= 10 ? "bg-red-500/20 text-red-600" : "bg-line text-muted"
                    }`}
                  >
                    {wait} min esperando
                  </span>
                )}
              </div>

              <ul className="mt-3 flex flex-col gap-2">
                {t.todo.map((item) => {
                  const options = parseOptions(item.options);
                  const change = data?.changes.find((c) => c.item_id === item.id);
                  return (
                    <li
                      key={item.id}
                      className={`rounded-xl border px-3 py-2 ${item.status === "preparing" ? "border-tomato/60" : "border-line"}`}
                    >
                      <p className="font-semibold">
                        {item.quantity}× {item.dish_name}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {[item.for_name, item.seat_label].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                      {options.length > 0 && <p className="text-sm">{options.map((o) => o.name).join(", ")}</p>}
                      {item.note && <p className="text-sm">📝 {item.note}</p>}
                      {item.changed_after_start && (
                        <p className="text-xs font-semibold text-amber-600">⚠ Modificado con cocina ya empezada</p>
                      )}
                      {change && (
                        <p className="text-xs font-semibold text-tomato">
                          ✏️ El comensal pidió un cambio; el mesero lo está consultando.
                        </p>
                      )}
                      {canCook && (
                        <div className="mt-2 flex gap-2">
                          {item.status === "pending" && (
                            <button type="button" className={smallButton} onClick={() => void setStatus([item.id], "preparing")}>
                              Empezar
                            </button>
                          )}
                          <button type="button" className={smallButton} onClick={() => void setStatus([item.id], "ready")}>
                            Listo
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {canCook && t.todo.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {waiting.length > 1 && (
                    <button
                      type="button"
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-tomato px-3 text-sm font-semibold text-white hover:bg-tomato-dark"
                      onClick={() => void setStatus(waiting.map((i) => i.id), "preparing")}
                    >
                      Empezar todo
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${smallButton} flex-1`}
                    onClick={() => void setStatus(t.todo.map((i) => i.id), "ready")}
                  >
                    Todo listo
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
