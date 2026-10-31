"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { ItemStatus, OrderItem, TableSession } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { formatPrice } from "@/lib/money";
import { itemsTotalCents, parseOptions } from "@/lib/order-items";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, smallButton } from "./styles";

type SessionWithItems = TableSession & { order_items: OrderItem[] };

/** Cada etapa del plato, qué botón la avanza y a qué estado pasa. */
const STAGES: { status: ItemStatus; title: string; action?: { label: string; next: ItemStatus } }[] = [
  { status: "pending", title: "Esperando", action: { label: "Enviar a cocina", next: "preparing" } },
  { status: "preparing", title: "En preparación", action: { label: "Marcar listos", next: "ready" } },
  { status: "ready", title: "Listos", action: { label: "Marcar servidos", next: "served" } },
];

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Tablero del personal: una tarjeta por mesa abierta, con sus platos agrupados por
 * etapa. Se actualiza en vivo cuando un comensal o un compañero agrega o cambia algo.
 */
export function OrdersBoard() {
  const restaurant = useRestaurant();
  const [actionError, setActionError] = useState<string | null>(null);

  const loader = useCallback(
    async (): Promise<SessionWithItems[]> =>
      unwrap(
        await getSupabase()
          .from("table_sessions")
          .select("*, order_items(*)")
          .eq("restaurant_id", restaurant.id)
          .eq("status", "open")
          .order("opened_at"),
      ),
    [restaurant.id],
  );
  const { data: sessions, error: loadError, reload } = useAsyncLoad(loader);

  // Tiempo real: platos y mesas del restaurante.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`board-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_sessions", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      .subscribe();
    // Respaldo por si se corta la conexión en vivo.
    const timer = setInterval(() => void reload(), 30_000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload]);

  /** Ejecuta una acción del personal y recarga; los errores se muestran en español. */
  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setActionError(error ? describeError(error.message) : null);
    await reload();
  }

  const setStatus = (ids: string[], status: ItemStatus) =>
    run(getSupabase().rpc("set_items_status", { p_item_ids: ids, p_status: status }));

  const closeTable = (session: SessionWithItems) => {
    if (!window.confirm(`¿Cerrar ${session.table_label}? Los comensales dejarán de poder pedir.`)) return;
    void run(getSupabase().rpc("close_session", { p_session_id: session.id }));
  };

  const error = actionError ?? loadError;
  if (!sessions && !error) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  // Primero las mesas con platos esperando; luego por antigüedad.
  const ordered = [...(sessions ?? [])].sort((a, b) => {
    const pa = a.order_items.some((i) => i.status === "pending") ? 0 : 1;
    const pb = b.order_items.some((i) => i.status === "pending") ? 0 : 1;
    return pa - pb || a.opened_at.localeCompare(b.opened_at);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-xs text-muted">Se actualiza en vivo</p>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {ordered.length === 0 && !error && (
        <p className="py-10 text-center text-muted">
          No hay mesas abiertas. Aparecerán aquí cuando un comensal entre a su mesa o tomes un pedido.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ordered.map((session) => {
          const items = session.order_items
            .filter((i) => i.status !== "cancelled")
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
          const served = items.filter((i) => i.status === "served");
          return (
            <article key={session.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{session.table_label}</h2>
                  <p className="text-xs text-muted">Abierta a las {time(session.opened_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-tomato">{formatPrice(itemsTotalCents(items))}</p>
                  <button type="button" className={`${smallButton} mt-1`} onClick={() => closeTable(session)}>
                    Cerrar mesa
                  </button>
                </div>
              </div>

              {items.length === 0 && <p className="mt-3 text-sm text-muted">Aún sin pedidos.</p>}

              {STAGES.map((stage) => {
                const stageItems = items.filter((i) => i.status === stage.status);
                if (stageItems.length === 0) return null;
                return (
                  <section key={stage.status} className="mt-4" aria-label={stage.title}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {stage.title} <span className="text-muted">({stageItems.length})</span>
                      </h3>
                      {stage.action && (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-full bg-tomato px-3 text-xs font-semibold text-white hover:bg-tomato-dark"
                          onClick={() => void setStatus(stageItems.map((i) => i.id), stage.action!.next)}
                        >
                          {stage.action.label}
                        </button>
                      )}
                    </div>
                    <ul className="mt-2 flex flex-col gap-2">
                      {stageItems.map((item) => (
                        <ItemRow key={item.id} item={item} onCancel={() => void setStatus([item.id], "cancelled")} />
                      ))}
                    </ul>
                  </section>
                );
              })}

              {served.length > 0 && (
                <p className="mt-4 text-xs text-muted">
                  {served.length} {served.length === 1 ? "plato servido" : "platos servidos"}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Una línea compacta de plato en el tablero. */
function ItemRow({ item, onCancel }: { item: OrderItem; onCancel: () => void }) {
  const options = parseOptions(item.options);
  return (
    <li className="rounded-xl border border-line px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {item.quantity}× {item.dish_name}
          </p>
          <p className="text-xs text-muted">
            {[item.for_name, item.seat_label].filter(Boolean).join(" · ") || "Mesa"}
            {item.added_by_staff ? " · mesero" : " · comensal"}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      {options.length > 0 && (
        <p className="mt-1 text-xs">{options.map((o) => o.name).join(", ")}</p>
      )}
      {item.note && <p className="mt-1 text-xs">📝 {item.note}</p>}
      {item.changed_after_start && (
        <p className="mt-1 text-xs font-semibold text-amber-600">⚠ Modificado con cocina ya empezada</p>
      )}
      <button type="button" onClick={onCancel} className="mt-1 text-xs text-red-600 underline">
        Cancelar plato
      </button>
    </li>
  );
}
