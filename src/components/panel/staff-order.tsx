"use client";

import { useCallback, useState, type FormEvent } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { formatPrice } from "@/lib/money";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton } from "./styles";
import { sortTables } from "./tables-manager";

export function StaffOrder() {
  const restaurant = useRestaurant();

  const loader = useCallback(async () => {
    const supabase = getSupabase();
    const [tables, dishes] = await Promise.all([
      supabase
        .from("dining_tables")
        .select("*, seats(*)")
        .eq("restaurant_id", restaurant.id)
        .eq("active", true),
      supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("available", true)
        .order("position")
        .order("name"),
    ]);
    return { tables: sortTables(unwrap(tables)), dishes: unwrap(dishes) };
  }, [restaurant.id]);
  const { data, error: loadError } = useAsyncLoad(loader);

  const [tableId, setTableId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [dinerName, setDinerName] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!data) {
    return loadError ? (
      <p role="alert" className="text-sm text-red-600">
        {loadError}
      </p>
    ) : (
      <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />
    );
  }

  const { tables, dishes } = data;
  const table = tables.find((t) => t.id === tableId);
  const lines = dishes.filter((d) => (quantities[d.id] ?? 0) > 0);
  const total = lines.reduce((sum, d) => sum + d.price_cents * (quantities[d.id] ?? 0), 0);
  const needsSeat = restaurant.identification === "seat";
  const canSend = !!table && lines.length > 0 && (!needsSeat || seatId !== "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setSent(false);
    const { error } = await getSupabase().rpc("staff_place_order", {
      p_table_id: tableId,
      p_items: lines.map((d) => ({ dish_id: d.id, quantity: quantities[d.id] })),
      p_seat_id: seatId || undefined,
      p_diner_name: dinerName || undefined,
      p_note: note || undefined,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
    setQuantities({});
    setNote("");
    setDinerName("");
    setSeatId("");
  }

  return (
    <form onSubmit={submit}>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Tomar pedido</h1>

      <div className={`${cardClass} grid gap-3 sm:grid-cols-3`}>
        <div>
          <label htmlFor="so-table" className="text-sm font-medium">
            Mesa
          </label>
          <select
            id="so-table"
            required
            value={tableId}
            onChange={(e) => {
              setTableId(e.target.value);
              setSeatId("");
              setSent(false);
            }}
            className={inputClass}
          >
            <option value="">Elige una mesa…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.reserved_by ? ` — ${t.reserved_by}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="so-seat" className="text-sm font-medium">
            Puesto{needsSeat ? "" : " (opcional)"}
          </label>
          <select
            id="so-seat"
            required={needsSeat}
            disabled={!table}
            value={seatId}
            onChange={(e) => setSeatId(e.target.value)}
            className={inputClass}
          >
            <option value="">{needsSeat ? "Elige un puesto…" : "Sin indicar"}</option>
            {table?.seats.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="so-name" className="text-sm font-medium">
            Nombre (opcional)
          </label>
          <input
            id="so-name"
            maxLength={60}
            value={dinerName}
            onChange={(e) => setDinerName(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {dishes.length === 0 ? (
        <p className="py-8 text-center text-muted">No hay platos disponibles. Añádelos en Menú.</p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {dishes.map((d) => (
            <li key={d.id} className={`${cardClass} flex items-center gap-3`}>
              <span className="text-2xl" aria-hidden="true">
                {d.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.name}</p>
                <p className="text-sm text-tomato">{formatPrice(d.price_cents)}</p>
              </div>
              <QuantityStepper
                value={quantities[d.id] ?? 0}
                min={0}
                label={`Cantidad de ${d.name}`}
                onChange={(q) => {
                  setSent(false);
                  setQuantities((prev) => ({ ...prev, [d.id]: q }));
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div className={`${cardClass} mt-4`}>
        <label htmlFor="so-note" className="text-sm font-medium">
          Nota para cocina (opcional)
        </label>
        <input
          id="so-note"
          maxLength={300}
          placeholder="Sin cebolla, punto medio…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-bold">
            Total <span className="text-tomato">{formatPrice(total)}</span>
          </p>
          <button type="submit" disabled={!canSend || busy} className={primaryButton}>
            {busy ? "Enviando…" : "Enviar a cocina"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {sent && (
          <p role="status" className="mt-2 text-sm text-green-600">
            ¡Pedido enviado a cocina!
          </p>
        )}
      </div>
    </form>
  );
}
