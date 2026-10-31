"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { ChangeRequest, ItemStatus, JoinRequest, OrderItem, ServiceRequest, TableSession } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { formatPrice } from "@/lib/money";
import { itemsTotalCents, parseOptions } from "@/lib/order-items";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { can } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { SERVICE_LABEL } from "@/lib/tags";
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
  const { role } = usePanel();
  const [actionError, setActionError] = useState<string | null>(null);

  /** Permiso que exige pasar un plato a cada estado (igual que en la base de datos). */
  const canMoveTo = (status: ItemStatus) =>
    can(role, status === "served" ? "orders.serve" : status === "cancelled" ? "orders.cancel" : "orders.kitchen");

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
  const { data: sessions, error: loadError, reload: reloadSessions } = useAsyncLoad(loader);

  // Avisos pendientes de los comensales («llamar al mesero», «pedir la cuenta»).
  const requestsLoader = useCallback(
    async (): Promise<ServiceRequest[]> =>
      unwrap(
        await getSupabase()
          .from("service_requests")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .is("resolved_at", null)
          .order("created_at"),
      ),
    [restaurant.id],
  );
  const { data: requests, reload: reloadRequests } = useAsyncLoad(requestsLoader);

  // Cambios que los comensales piden sobre platos que cocina ya empezó: el mesero decide.
  const changesLoader = useCallback(
    async (): Promise<ChangeRequest[]> =>
      unwrap(
        await getSupabase()
          .from("change_requests")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .eq("status", "pending")
          .order("created_at"),
      ),
    [restaurant.id],
  );
  const { data: changes, reload: reloadChanges } = useAsyncLoad(changesLoader);

  // Personas que eligieron una mesa a mano y esperan que el mesero les dé acceso.
  const joinsLoader = useCallback(
    async (): Promise<(JoinRequest & { table_label: string; seat_label: string | null })[]> => {
      const rows = unwrap(
        await getSupabase()
          .from("join_requests")
          .select("*, dining_tables(label), seats(label)")
          .eq("restaurant_id", restaurant.id)
          .eq("status", "pending")
          .order("created_at"),
      );
      return rows.map((r) => ({
        ...r,
        table_label: r.dining_tables?.label ?? "Mesa",
        seat_label: r.seats?.label ?? null,
      }));
    },
    [restaurant.id],
  );
  const { data: joins, reload: reloadJoins } = useAsyncLoad(joinsLoader);

  const reload = useCallback(async () => {
    await Promise.all([reloadSessions(), reloadRequests(), reloadChanges(), reloadJoins()]);
  }, [reloadSessions, reloadRequests, reloadChanges, reloadJoins]);

  // Tiempo real: platos, mesas y avisos del restaurante.
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "join_requests", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "change_requests", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `restaurant_id=eq.${restaurant.id}` },
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

  /** Acepta o rechaza un cambio pedido por un comensal (lanza si falla; se adapta al formato de run). */
  const resolveItemChange = async (id: string, accept: boolean) => {
    const { error } = await getSupabase().rpc("resolve_item_change", { p_request_id: id, p_accept: accept });
    return { error };
  };

  /** Da acceso a quien eligió una mesa a mano, o lo rechaza. */
  const resolveJoin = async (id: string, accept: boolean) => {
    const { error } = await getSupabase().rpc("resolve_join_request", { p_request_id: id, p_accept: accept });
    return { error };
  };

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
      {requests && requests.length > 0 && (
        <section aria-label="Avisos" className="mb-4 flex flex-col gap-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <p className="font-semibold">
                🔔 {r.table_label}
                {r.seat_label ? ` · ${r.seat_label}` : ""}: {SERVICE_LABEL[r.kind === "bill" ? "bill" : "waiter"]}{" "}
                <span className="text-sm font-normal opacity-70">desde las {time(r.created_at)}</span>
              </p>
              <button
                type="button"
                className={smallButton}
                onClick={() => void run(getSupabase().rpc("resolve_request", { p_request_id: r.id }))}
              >
                Atendido
              </button>
            </div>
          ))}
        </section>
      )}
      {joins && joins.length > 0 && can(role, "orders.take") && (
        <section aria-label="Quieren sentarse" className="mb-4 flex flex-col gap-2">
          {joins.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-green-500/50 bg-green-500/10 px-4 py-3">
              <p className="font-semibold">
                🪑 {j.display_name || "Un comensal"} quiere sentarse en {j.table_label}
                {j.seat_label ? ` · ${j.seat_label}` : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-full bg-tomato px-3 text-xs font-semibold text-white hover:bg-tomato-dark"
                  onClick={() => void run(resolveJoin(j.id, true))}
                >
                  Dar acceso
                </button>
                <button type="button" className={smallButton} onClick={() => void run(resolveJoin(j.id, false))}>
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {changes && changes.length > 0 && can(role, "orders.take") && (
        <section aria-label="Cambios pedidos" className="mb-4 flex flex-col gap-2">
          {changes.map((c) => {
            const item = (sessions ?? []).flatMap((s) => s.order_items).find((i) => i.id === c.item_id);
            const table = (sessions ?? []).find((s) => s.id === c.session_id)?.table_label ?? "Mesa";
            return (
              <div key={c.id} className="rounded-2xl border border-tomato/50 bg-tomato/10 px-4 py-3">
                <p className="font-semibold">
                  ✏️ {table}: {item ? `${item.quantity}× ${item.dish_name}` : "plato"}{" "}
                  <span className="text-sm font-normal text-muted">(en preparación)</span>
                </p>
                <p className="mt-1 text-sm">{c.message}</p>
                <p className="mt-1 text-xs text-muted">Consulta con cocina si todavía se puede.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-full bg-tomato px-3 text-xs font-semibold text-white hover:bg-tomato-dark"
                    onClick={() => void run(resolveItemChange(c.id, true))}
                  >
                    Aceptar cambio
                  </button>
                  <button type="button" className={smallButton} onClick={() => void run(resolveItemChange(c.id, false))}>
                    No se puede
                  </button>
                </div>
              </div>
            );
          })}
        </section>
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
                  <p className="text-xs text-muted">
                    {!session.confirmed && <span className="mr-1 font-semibold text-amber-600">Por confirmar · </span>}
                    Abierta a las {time(session.opened_at)} · código <span className="font-mono font-semibold tracking-widest">{session.join_code}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-tomato">{formatPrice(itemsTotalCents(items))}</p>
                  {!session.confirmed && can(role, "orders.take") && (
                    <button
                      type="button"
                      className={`${smallButton} mt-1 mr-1`}
                      onClick={() => void run(getSupabase().rpc("confirm_session", { p_session_id: session.id }))}
                    >
                      Confirmar mesa
                    </button>
                  )}
                  {can(role, "session.close") && (
                    <button type="button" className={`${smallButton} mt-1`} onClick={() => closeTable(session)}>
                      Cerrar mesa
                    </button>
                  )}
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
                      {stage.action && canMoveTo(stage.action.next) && (
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
                        <ItemRow
                          key={item.id}
                          item={item}
                          onCancel={canMoveTo("cancelled") ? () => void setStatus([item.id], "cancelled") : undefined}
                        />
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
function ItemRow({ item, onCancel }: { item: OrderItem; onCancel?: () => void }) {
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
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-1 text-xs text-red-600 underline">
          Cancelar plato
        </button>
      )}
    </li>
  );
}
