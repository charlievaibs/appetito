"use client";

import { useState } from "react";
import { describeError } from "@/lib/errors";
import { usePricing } from "@/lib/pricing";
import { parseRecipeQuantity, recipeCostCents, recipeMargin } from "@/lib/recipes";
import { getSupabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { inputClass, primaryButton, secondaryButton, smallButton } from "./styles";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
type Line = { item_id: string; quantity: string };

/**
 * Receta de un plato: qué artículos del inventario lleva UNA porción y cuánto. Con ella el inventario se
 * descuenta solo cuando cocina empieza a preparar el plato, y se ve el costo y el margen.
 */
export function DishRecipeEditor({
  dishId,
  priceCents,
  items,
  initial,
  onSaved,
}: {
  dishId: string;
  /** Precio del plato sin IVA, en céntimos. */
  priceCents: number;
  /** Artículos del inventario (activos). */
  items: Item[];
  initial: { item_id: string; quantity: number }[];
  onSaved: () => void;
}) {
  const { format } = usePricing();
  const [lines, setLines] = useState<Line[]>(initial.map((l) => ({ item_id: l.item_id, quantity: String(l.quantity) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const byId = new Map(items.map((i) => [i.id, i]));
  const unused = items.filter((i) => i.active && !lines.some((l) => l.item_id === i.id));

  const parsed = lines.map((l) => ({ item_id: l.item_id, quantity: parseRecipeQuantity(l.quantity) }));
  const valid = parsed.every((l) => l.quantity !== null);
  const cost = recipeCostCents(
    parsed.map((l) => ({ item_id: l.item_id, quantity: l.quantity ?? 0 })),
    byId,
  );
  const margin = recipeMargin(priceCents, cost);

  function update(index: number, patch: Partial<Line>) {
    setSaved(false);
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!valid) {
      setError("Revisa las cantidades: deben ser números mayores que cero, por ejemplo 0,25");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("set_dish_recipe", {
      p_dish_id: dishId,
      p_lines: parsed.map((l) => ({ item_id: l.item_id, quantity: l.quantity as number })),
    });
    setBusy(false);
    if (error) {
      setError(describeError(error.message));
      return;
    }
    setSaved(true);
    onSaved();
  }

  return (
    <div className="mt-4 rounded-xl border border-line p-4">
      <p className="font-semibold">Receta (una porción)</p>
      <p className="mb-3 text-sm text-muted">
        El inventario se descuenta solo cuando cocina empieza a preparar el plato. Cancelar antes de empezar no descuenta
        nada; cancelar después no devuelve el stock.
      </p>

      {items.length === 0 && (
        <p className="text-sm text-muted">Primero crea artículos en Inventario para poder armar la receta.</p>
      )}

      <ul className="flex flex-col gap-2">
        {lines.map((l, i) => {
          const item = byId.get(l.item_id);
          return (
            <li key={l.item_id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-40 flex-1 font-medium">{item?.name ?? "Artículo eliminado"}</span>
              <label className="sr-only" htmlFor={`rq-${l.item_id}`}>
                Cantidad de {item?.name}
              </label>
              <input
                id={`rq-${l.item_id}`}
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                className={`${inputClass} w-28`}
                aria-invalid={parseRecipeQuantity(l.quantity) === null}
              />
              <span className="w-8 text-sm text-muted">{item?.unit}</span>
              <button
                type="button"
                className={`${smallButton} text-red-600`}
                onClick={() => {
                  setSaved(false);
                  setLines(lines.filter((_, j) => j !== i));
                }}
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>

      {unused.length > 0 && (
        <div className="mt-3">
          <label className="sr-only" htmlFor={`add-${dishId}`}>
            Añadir ingrediente
          </label>
          <select
            id={`add-${dishId}`}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setSaved(false);
              setLines([...lines, { item_id: e.target.value, quantity: "" }]);
            }}
            className="h-11 rounded-xl border border-line bg-card px-3"
          >
            <option value="">+ Añadir ingrediente…</option>
            {unused.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>
      )}

      {lines.length > 0 && (
        <p className="mt-3 text-sm">
          Costo por porción <strong>{format(cost)}</strong> · precio {format(priceCents)} · ganancia{" "}
          <strong className={margin.cents < 0 ? "text-red-600" : ""}>
            {format(margin.cents)}
            {margin.percent !== null && ` (${margin.percent} %)`}
          </strong>{" "}
          <span className="text-muted">(sin IVA)</span>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className={primaryButton} disabled={busy} onClick={() => void save()}>
          Guardar receta
        </button>
        {lines.length > 0 && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setSaved(false);
              setLines([]);
            }}
          >
            Vaciar
          </button>
        )}
        {saved && <span role="status" className="text-sm text-muted">Guardada ✓</span>}
      </div>
    </div>
  );
}
