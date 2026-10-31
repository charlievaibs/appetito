"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteQr } from "@/components/invite-qr";
import type { DiningTable, JoinRequest, ServiceRequest, TableSession } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { closeTable } from "@/lib/close-table";
import { can, canCloseTable, canForceClose } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { SERVICE_LABEL } from "@/lib/tags";
import { parseStaffNames, personLabel, type StaffName } from "@/lib/team";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, primaryButton, smallButton } from "./styles";

type SalonData = {
  tables: DiningTable[];
  sessions: TableSession[];
  services: ServiceRequest[];
  joins: JoinRequest[];
  /** Nombres del equipo, para mostrar quién atiende cada mesa. */
  staff: StaffName[];
};

type TableState = "free" | "occupied" | "unconfirmed" | "reserved";

const STATE_LABEL: Record<TableState, string> = {
  free: "Libre",
  occupied: "Ocupada",
  unconfirmed: "Por confirmar",
  reserved: "Reservada",
};

const STATE_STYLE: Record<TableState, string> = {
  free: "bg-green-500/20 text-green-600",
  occupied: "bg-line text-muted",
  unconfirmed: "bg-amber-500/20 text-amber-600",
  reserved: "bg-amber-500/20 text-amber-600",
};

/**
 * Salón del mesero: las mesas del restaurante de un vistazo, con su estado y avisos.
 * Al tocar una se abre (si está libre) y se muestra el QR de invitación que cambia solo,
 * para que el grupo se una escaneándolo sin que una foto del QR fijo sirva de nada.
 */
export function SalonBoard() {
  const restaurant = useRestaurant();
  const { role, state } = usePanel();
  const myId = state.status === "ready" ? state.userId : "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loader = useCallback(async (): Promise<SalonData> => {
    const supabase = getSupabase();
    const [tables, sessions, services, joins, staff] = await Promise.all([
      supabase.from("dining_tables").select("*").eq("restaurant_id", restaurant.id).eq("active", true),
      supabase.from("table_sessions").select("*").eq("restaurant_id", restaurant.id).eq("status", "open"),
      supabase.from("service_requests").select("*").eq("restaurant_id", restaurant.id).is("resolved_at", null),
      supabase.from("join_requests").select("*").eq("restaurant_id", restaurant.id).eq("status", "pending"),
      supabase.rpc("list_staff_names", { p_restaurant_id: restaurant.id }),
    ]);
    return {
      tables: unwrap(tables).toSorted((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })),
      sessions: unwrap(sessions),
      services: unwrap(services),
      joins: unwrap(joins),
      staff: parseStaffNames(unwrap(staff)),
    };
  }, [restaurant.id]);
  const { data, error: loadError, reload } = useAsyncLoad(loader);

  // Tiempo real: mesas abiertas, avisos y solicitudes de acceso.
  useEffect(() => {
    const supabase = getSupabase();
    const filter = `restaurant_id=eq.${restaurant.id}`;
    const channel = supabase
      .channel(`salon-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions", filter }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests", filter }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests", filter }, () => void reload())
      .subscribe();
    const backup = setInterval(() => void reload(), 30_000);
    return () => {
      clearInterval(backup);
      void supabase.removeChannel(channel);
    };
  }, [restaurant.id, reload]);

  /** Ejecuta una operación del personal, muestra el error en español y recarga. */
  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setError(error ? describeError(error.message) : null);
    await reload();
  }

  if (!data && !(error ?? loadError)) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }
  const { tables, sessions, services, joins, staff } = data ?? { tables: [], sessions: [], services: [], joins: [], staff: [] };
  const waiterName = (id: string | null) => {
    const p = staff.find((x) => x.userId === id);
    return p ? personLabel({ displayName: p.name }) : null;
  };

  const stateOf = (table: DiningTable): TableState => {
    const session = sessions.find((s) => s.table_id === table.id);
    if (session) return session.confirmed ? "occupied" : "unconfirmed";
    return table.reservation_code ? "reserved" : "free";
  };
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Salón</h1>
        <p className="text-xs text-muted">Se actualiza en vivo</p>
      </div>
      {(error ?? loadError) && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error ?? loadError}
        </p>
      )}
      {tables.length === 0 && <p className="py-10 text-center text-muted">Aún no hay mesas. Añádelas en «Mesas».</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Mesas">
        {tables.map((t) => {
          const state = stateOf(t);
          const session = sessions.find((s) => s.table_id === t.id);
          const calls = session ? services.filter((s) => s.session_id === session.id) : [];
          const asking = joins.filter((j) => j.table_id === t.id).length;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                aria-pressed={t.id === selectedId}
                className={`h-full w-full rounded-2xl border p-3 text-left transition-colors ${
                  t.id === selectedId ? "border-tomato bg-tomato/10" : "border-line bg-card hover:bg-line"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{t.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[state]}`}>
                    {STATE_LABEL[state]}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {t.capacity} personas
                  {session && (waiterName(session.waiter_id) ? ` · 👤 ${waiterName(session.waiter_id)}` : " · sin mesero")}
                </span>
                {(calls.length > 0 || asking > 0) && (
                  <span className="mt-2 flex flex-wrap gap-1 text-xs font-medium">
                    {calls.map((c) => (
                      <span key={c.id} className="rounded-full bg-tomato px-2 py-0.5 text-white">
                        {c.kind === "bill" ? "🧾 Cuenta" : "🔔 Llama"}
                      </span>
                    ))}
                    {asking > 0 && <span className="rounded-full bg-green-600 px-2 py-0.5 text-white">🪑 {asking}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <TablePanel
          key={selected.id}
          table={selected}
          session={sessions.find((s) => s.table_id === selected.id) ?? null}
          services={services}
          joins={joins.filter((j) => j.table_id === selected.id)}
          staff={staff}
          myId={myId}
          canAssign={can(role, "team.manage")}
          canOpen={can(role, "orders.take")}
          canClose={canCloseTable(role, restaurant.table_close as "cashier" | "staff")}
          canForce={canForceClose(role)}
          run={run}
        />
      )}
    </div>
  );
}

/** Detalle de la mesa elegida: abrirla, mostrar el QR de invitación, atender avisos y cerrarla. */
function TablePanel({
  table,
  session,
  services,
  joins,
  staff,
  myId,
  canAssign,
  canOpen,
  canClose,
  canForce,
  run,
}: {
  table: DiningTable;
  session: TableSession | null;
  services: ServiceRequest[];
  joins: JoinRequest[];
  staff: StaffName[];
  myId: string;
  canAssign: boolean;
  canOpen: boolean;
  canClose: boolean;
  canForce: boolean;
  run: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<void>;
}) {
  const supabase = getSupabase();
  const calls = session ? services.filter((s) => s.session_id === session.id) : [];

  return (
    <section className={`${cardClass} mt-4`} aria-label={`Detalle de ${table.label}`}>
      <h2 className="text-lg font-bold">{table.label}</h2>

      {joins.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {joins.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-500/10 px-3 py-2">
              <p className="text-sm font-medium">🪑 {j.display_name || "Un comensal"} quiere sentarse</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-full bg-tomato px-3 text-xs font-semibold text-white hover:bg-tomato-dark"
                  onClick={() => void run(supabase.rpc("resolve_join_request", { p_request_id: j.id, p_accept: true }))}
                >
                  Dar acceso
                </button>
                <button
                  type="button"
                  className={smallButton}
                  onClick={() => void run(supabase.rpc("resolve_join_request", { p_request_id: j.id, p_accept: false }))}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!session && (
        <div className="mt-3">
          <p className="text-sm text-muted">
            {table.reservation_code
              ? `Reservada${table.reserved_by ? ` por ${table.reserved_by}` : ""}. Ábrela cuando lleguen y comparte el QR.`
              : "Mesa libre. Ábrela cuando sientes a un grupo y compártele el QR."}
          </p>
          {canOpen ? (
            <button
              type="button"
              className={`${primaryButton} mt-3`}
              onClick={() => void run(supabase.rpc("staff_open_session", { p_table_id: table.id }))}
            >
              Abrir mesa
            </button>
          ) : (
            <p className="mt-3 text-sm text-muted">Tu rol no abre mesas.</p>
          )}
        </div>
      )}

      {session && (
        <div className="mt-3 flex flex-col items-center gap-3 text-center">
          {!session.confirmed && (
            <div className="w-full rounded-xl bg-amber-500/15 px-3 py-2 text-left text-sm">
              <p className="font-semibold">Alguien abrió esta mesa escaneando el QR.</p>
              <p className="text-muted">Hasta que confirmes que hay gente sentada, sus pedidos no llegan a cocina.</p>
              {canOpen && (
                <button
                  type="button"
                  className={`${smallButton} mt-2`}
                  onClick={() => void run(supabase.rpc("confirm_session", { p_session_id: session.id }))}
                >
                  Hay gente: confirmar mesa
                </button>
              )}
            </div>
          )}

          <div className="flex w-full flex-wrap items-center justify-center gap-2 text-sm">
            <span>
              Atiende:{" "}
              <strong>{staff.find((p) => p.userId === session.waiter_id)?.name ?? (session.waiter_id ? "un compañero" : "nadie todavía")}</strong>
            </span>
            {canOpen && session.waiter_id !== myId && (
              <button type="button" className={smallButton} onClick={() => void run(supabase.rpc("claim_session", { p_session_id: session.id }))}>
                Atender yo
              </button>
            )}
            {canAssign && (
              <select
                aria-label="Asignar mesa a"
                value=""
                onChange={(e) => e.target.value && void run(supabase.rpc("assign_session", { p_session_id: session.id, p_user_id: e.target.value }))}
                className="h-9 rounded-xl border border-line bg-background px-2 text-sm"
              >
                <option value="">Asignar a…</option>
                {staff
                  .filter((p) => ["owner", "manager", "host", "waiter"].includes(p.role))
                  .map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {personLabel({ displayName: p.name })}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <p className="text-sm text-muted">Que el grupo escanee este QR para unirse a la mesa:</p>
          {canOpen && <InviteQr sessionId={session.id} size={240} />}
          <p className="text-sm">
            Código para escribir:{" "}
            <span className="font-mono text-base font-semibold tracking-widest">{session.join_code}</span>
          </p>

          {calls.length > 0 && (
            <div className="flex w-full flex-col gap-2 text-left">
              {calls.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-tomato/10 px-3 py-2">
                  <p className="text-sm font-medium">
                    🔔 {SERVICE_LABEL[c.kind === "bill" ? "bill" : "waiter"]}
                    {c.seat_label ? ` · ${c.seat_label}` : ""}
                  </p>
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => void run(supabase.rpc("resolve_request", { p_request_id: c.id }))}
                  >
                    Atendido
                  </button>
                </div>
              ))}
            </div>
          )}

          {canClose && (
            <button
              type="button"
              className={`${smallButton} text-red-600`}
              onClick={() => {
                if (window.confirm(`¿Cerrar ${table.label}? Los comensales dejarán de poder pedir.`)) {
                  void run(
                    closeTable((name, args) => supabase.rpc(name, args), session.id, {
                      canForce,
                      confirmForce: () => window.confirm(`${table.label} todavía tiene saldo sin cobrar. ¿Cerrarla igualmente? Quedará anotado como deuda.`),
                    }).then((message) => ({ error: message ? { message } : null })),
                  );
                }
              }}
            >
              Cerrar mesa
            </button>
          )}
        </div>
      )}
    </section>
  );
}
