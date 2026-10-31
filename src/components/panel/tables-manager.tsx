"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { QrImage, qrLink } from "@/components/qr-image";
import type { DiningTable, Seat } from "@/lib/db";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, secondaryButton, smallButton } from "./styles";

export type TableWithSeats = DiningTable & { seats: Seat[] };

export function sortTables(tables: TableWithSeats[]): TableWithSeats[] {
  return tables
    .map((t) => ({ ...t, seats: [...t.seats].sort((a, b) => a.position - b.position) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
}

export function useTables() {
  const restaurant = useRestaurant();
  const loader = useCallback(async () => {
    const rows = unwrap(
      await getSupabase()
        .from("dining_tables")
        .select("*, seats(*)")
        .eq("restaurant_id", restaurant.id),
    );
    return sortTables(rows);
  }, [restaurant.id]);
  return useAsyncLoad(loader);
}

function newToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function TablesManager() {
  const restaurant = useRestaurant();
  const { data: tables, error: loadError, reload } = useTables();
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [withSeats, setWithSeats] = useState(true);
  const [busy, setBusy] = useState(false);

  async function addTable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const { data: table, error } = await supabase
      .from("dining_tables")
      .insert({ restaurant_id: restaurant.id, label: label.trim(), capacity })
      .select()
      .single();
    if (error) {
      setError(error.code === "23505" ? "Ya existe una mesa con ese nombre." : error.message);
    } else {
      if (withSeats) {
        const seats = Array.from({ length: capacity }, (_, i) => ({
          table_id: table.id,
          label: `Puesto ${i + 1}`,
          position: i + 1,
        }));
        const { error: seatError } = await supabase.from("seats").insert(seats);
        if (seatError) setError(seatError.message);
      }
      setLabel("");
    }
    setBusy(false);
    await reload();
  }

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setError(error ? error.message : null);
    await reload();
  }

  const shownError = error ?? loadError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Mesas y puestos</h1>
        <Link href="/panel/mesas/qr" className={secondaryButton}>
          Hoja de QR para imprimir
        </Link>
      </div>

      <form onSubmit={addTable} className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <div className="min-w-40 flex-1">
          <label htmlFor="t-label" className="text-sm font-medium">
            Nombre de la mesa
          </label>
          <input
            id="t-label"
            required
            maxLength={40}
            placeholder="Mesa 5"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-28">
          <label htmlFor="t-cap" className="text-sm font-medium">
            Capacidad
          </label>
          <input
            id="t-cap"
            type="number"
            min={1}
            max={50}
            required
            value={capacity}
            onChange={(e) => setCapacity(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            className={inputClass}
          />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withSeats}
            onChange={(e) => setWithSeats(e.target.checked)}
          />
          Crear un puesto por comensal
        </label>
        <button type="submit" disabled={busy} className={primaryButton}>
          Añadir mesa
        </button>
      </form>

      {shownError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {shownError}
        </p>
      )}

      {!tables && !shownError && (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-card" aria-hidden="true" />
      )}
      {tables?.length === 0 && (
        <p className="py-10 text-center text-muted">Todavía no tienes mesas. Añade la primera.</p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {tables?.map((t) => (
          <TableCard key={t.id} table={t} run={run} />
        ))}
      </div>
    </div>
  );
}

function TableCard({
  table,
  run,
}: {
  table: TableWithSeats;
  run: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<void>;
}) {
  const [reservedBy, setReservedBy] = useState(table.reserved_by ?? "");
  const [showQr, setShowQr] = useState(false);
  const supabase = getSupabase();
  const dirty = reservedBy.trim() !== (table.reserved_by ?? "");

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{table.label}</h2>
          <p className="text-sm text-muted">
            {table.capacity} personas · {table.seats.length} puestos
            {!table.active && " · desactivada"}
          </p>
        </div>
        <button
          type="button"
          className={smallButton}
          onClick={() =>
            void run(supabase.from("dining_tables").update({ active: !table.active }).eq("id", table.id))
          }
        >
          {table.active ? "Desactivar" : "Activar"}
        </button>
      </div>

      <label htmlFor={`rb-${table.id}`} className="mt-3 block text-sm font-medium">
        Reservada por (opcional)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`rb-${table.id}`}
          maxLength={80}
          placeholder="Reserva de Juan"
          value={reservedBy}
          onChange={(e) => setReservedBy(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          disabled={!dirty}
          className={smallButton}
          onClick={() =>
            void run(
              supabase
                .from("dining_tables")
                .update({ reserved_by: reservedBy.trim() || null })
                .eq("id", table.id),
            )
          }
        >
          Guardar
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={smallButton} onClick={() => setShowQr(!showQr)}>
          {showQr ? "Ocultar QR" : "Ver QR"}
        </button>
        <button
          type="button"
          className={smallButton}
          onClick={() => {
            if (window.confirm("Los QR impresos de esta mesa y sus puestos dejarán de funcionar. ¿Continuar?")) {
              void (async () => {
                const results = await Promise.all([
                  supabase.from("dining_tables").update({ qr_token: newToken() }).eq("id", table.id),
                  ...table.seats.map((s) =>
                    supabase.from("seats").update({ qr_token: newToken() }).eq("id", s.id),
                  ),
                ]);
                await run(Promise.resolve({ error: results.find((r) => r.error)?.error ?? null }));
              })();
            }
          }}
        >
          Regenerar QR
        </button>
        <button
          type="button"
          className={`${smallButton} text-red-600`}
          onClick={() => {
            if (window.confirm(`¿Eliminar ${table.label}? Sus pedidos anteriores se conservan.`)) {
              void run(supabase.from("dining_tables").delete().eq("id", table.id));
            }
          }}
        >
          Eliminar
        </button>
      </div>

      {showQr && (
        <div className="mt-4 flex flex-wrap gap-4">
          <figure className="text-center text-xs">
            <QrImage value={qrLink(table.qr_token)} label={`QR de ${table.label}`} size={120} />
            <figcaption className="mt-1 font-medium">Mesa</figcaption>
          </figure>
          {table.seats.map((s) => (
            <figure key={s.id} className="text-center text-xs">
              <QrImage value={qrLink(s.qr_token)} label={`QR de ${s.label}`} size={120} />
              <figcaption className="mt-1">{s.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </article>
  );
}
