"use client";

import { useCallback, useEffect, useState } from "react";
import type { Order, OrderItem, OrderStatus } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, smallButton } from "./styles";

type OrderWithItems = Order & { order_items: OrderItem[] };

const ADVANCE: Partial<Record<string, { status: OrderStatus; label: string }>> = {
  received: { status: "preparing", label: "Enviar a cocina" },
  preparing: { status: "served", label: "Marcar servido" },
};

const COLUMNS = [
  { status: "received", title: "Nuevos" },
  { status: "preparing", title: "En cocina" },
  { status: "served", title: "Servidos" },
];

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function OrdersBoard() {
  const restaurant = useRestaurant();
  const [actionError, setActionError] = useState<string | null>(null);

  const loader = useCallback(async (): Promise<OrderWithItems[]> => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return unwrap(
      await getSupabase()
        .from("orders")
        .select("*, order_items(*)")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
    );
  }, [restaurant.id]);

  const { data: orders, error: loadError, reload } = useAsyncLoad(loader);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => void reload(),
      )
      .subscribe();
    // Respaldo por si la conexión en vivo se corta.
    const timer = setInterval(() => void reload(), 30_000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload]);

  async function setStatus(id: string, status: OrderStatus) {
    const { error } = await getSupabase().from("orders").update({ status }).eq("id", id);
    setActionError(error ? error.message : null);
    await reload();
  }

  const error = actionError ?? loadError;

  if (!orders && !error) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  const visible = (orders ?? []).filter((o) => o.status !== "cancelled");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-xs text-muted">Se actualiza en vivo · últimas 24 h</p>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {visible.length === 0 && !error && (
        <p className="py-10 text-center text-muted">
          Aún no hay pedidos. Aparecerán aquí en cuanto lleguen.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = visible.filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title}>
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                {col.title}
                <span className="rounded-full bg-line px-2 text-xs">{items.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((o) => {
                  const next = ADVANCE[o.status];
                  return (
                    <article key={o.id} className={cardClass}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {o.table_label}
                            {o.seat_label ? ` · ${o.seat_label}` : ""}
                          </p>
                          {o.diner_name && <p className="text-sm text-muted">{o.diner_name}</p>}
                        </div>
                        <span className="text-xs text-muted">{time(o.created_at)}</span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm">
                        {o.order_items.map((i) => (
                          <li key={i.id}>
                            {i.quantity}× {i.dish_name}
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mt-2 rounded-lg bg-tomato/10 px-2 py-1 text-sm">
                          📝 {o.note}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="font-bold text-tomato">{formatPrice(o.total_cents)}</span>
                        <div className="flex gap-2">
                          {o.status !== "served" && (
                            <button
                              type="button"
                              className={smallButton}
                              onClick={() => void setStatus(o.id, "cancelled")}
                            >
                              Cancelar
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              className="inline-flex h-9 items-center rounded-full bg-tomato px-4 text-sm font-semibold text-white hover:bg-tomato-dark"
                              onClick={() => void setStatus(o.id, next.status)}
                            >
                              {next.label}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
