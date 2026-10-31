"use client";

import { useCallback, useState, type FormEvent } from "react";
import { DishPicker, type PickerValues } from "@/components/dish-picker";
import { MenuList } from "@/components/menu-list";
import { addItems } from "@/lib/diner-api";
import type { DishWithOptions } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { usePricing } from "@/lib/pricing";
import { MAX_QUANTITY, optionsDeltaCents } from "@/lib/order-items";
import { useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, smallButton } from "./styles";
import { sortTables } from "./tables-manager";

/** Un plato elegido por el mesero que aún no se ha enviado. */
type Line = { key: number; dish: DishWithOptions; values: PickerValues };

/**
 * Toma de pedido del mesero. Elige mesa (y opcionalmente puesto y nombre), agrega
 * platos con sus ajustes y los envía a la misma mesa en la que los comensales
 * también pueden pedir: todo aparece en vivo en ambos lados.
 */
export function StaffOrder() {
  const { format } = usePricing();
  const restaurant = useRestaurant();

  const loader = useCallback(async () => {
    const supabase = getSupabase();
    const [tables, dishes] = await Promise.all([
      supabase.from("dining_tables").select("*, seats(*)").eq("restaurant_id", restaurant.id).eq("active", true),
      supabase
        .from("dishes")
        .select("*, dish_option_groups(*, dish_options(*))")
        .eq("restaurant_id", restaurant.id)
        .eq("available", true)
        .order("position")
        .order("name"),
    ]);
    return { tables: sortTables(unwrap(tables)), dishes: unwrap(dishes) as DishWithOptions[] };
  }, [restaurant.id]);
  const { data, error: loadError } = useAsyncLoad(loader);

  const [tableId, setTableId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [dinerName, setDinerName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<DishWithOptions | null>(null);
  const [nextKey, setNextKey] = useState(1);
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
  const needsSeat = restaurant.identification === "seat";
  const canSend = !!table && lines.length > 0 && (!needsSeat || seatId !== "");
  const total = lines.reduce(
    (sum, l) =>
      sum +
      (l.dish.price_cents + optionsDeltaCents(l.dish.dish_option_groups, l.values.optionIds)) *
        Math.min(l.values.quantity, MAX_QUANTITY),
    0,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      // Abre (o recupera) la sesión de la mesa y agrega todos los platos de una vez.
      const { data: sessionId, error } = await getSupabase().rpc("staff_open_session", { p_table_id: tableId });
      if (error) throw new Error(describeError(error.message));
      await addItems(
        sessionId,
        lines.map((l) => ({ dishId: l.dish.id, ...l.values })),
        { seatId: seatId || undefined, forName: dinerName || undefined },
      );
      setSent(true);
      setLines([]);
      setDinerName("");
      setSeatId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el pedido.");
    } finally {
      setBusy(false);
    }
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {dishes.length === 0 ? (
            <p className="py-8 text-center text-muted">No hay platos disponibles. Añádelos en Menú.</p>
          ) : (
            <MenuList dishes={dishes} onPick={setPicking} />
          )}
        </div>

        <aside className={`${cardClass} h-fit`} aria-label="Platos por enviar">
          <h2 className="font-semibold">Por enviar</h2>
          {lines.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Elige platos del menú.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {lines.map((l) => (
                <li key={l.key} className="rounded-xl border border-line px-3 py-2 text-sm">
                  <p className="font-medium">
                    {l.values.quantity}× {l.dish.name}
                  </p>
                  {l.values.optionIds.length > 0 && (
                    <p className="text-xs text-muted">
                      {l.dish.dish_option_groups
                        .flatMap((g) => g.dish_options)
                        .filter((o) => l.values.optionIds.includes(o.id))
                        .map((o) => o.name)
                        .join(", ")}
                    </p>
                  )}
                  {l.values.note && <p className="text-xs text-muted">📝 {l.values.note}</p>}
                  <button
                    type="button"
                    className="mt-1 text-xs text-red-600 underline"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-lg font-bold">
            Total <span className="text-tomato">{format(total)}</span>
          </p>
          <button type="submit" disabled={!canSend || busy} className={`mt-3 w-full ${primaryButton}`}>
            {busy ? "Enviando…" : "Enviar pedido"}
          </button>
          {lines.length > 0 && (
            <button type="button" className={`mt-2 w-full ${smallButton}`} onClick={() => setLines([])}>
              Vaciar
            </button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {sent && (
            <p role="status" className="mt-2 text-sm text-green-600">
              ¡Pedido enviado! Ya está en el tablero y en el móvil de los comensales.
            </p>
          )}
        </aside>
      </div>

      {picking && (
        <DishPicker
          key={picking.id}
          dish={picking}
          confirmLabel="Agregar"
          onConfirm={async (values) => {
            setLines((prev) => [...prev, { key: nextKey, dish: picking, values }]);
            setNextKey((k) => k + 1);
            setSent(false);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      )}
    </form>
  );
}
