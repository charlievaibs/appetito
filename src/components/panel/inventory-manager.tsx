"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { describeError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/money";
import { usePricing } from "@/lib/pricing";
import { useRestaurant, usePanel } from "@/lib/panel-context";
import { can } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import type { Database } from "@/lib/database.types";
import { ImportExport } from "./import-export";
import { cardClass, inputClass, primaryButton, secondaryButton, smallButton } from "./styles";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
type Movement = Database["public"]["Tables"]["inventory_movements"]["Row"];

const UNITS = ["u", "kg", "g", "l", "ml"] as const;
const REASON_LABEL: Record<string, string> = {
  compra: "Compra",
  merma: "Merma",
  ajuste: "Ajuste",
  consumo: "Consumo",
  importacion: "Importación",
  inicial: "Stock inicial",
};

const isLow = (i: Item) => i.min_stock > 0 && i.stock <= i.min_stock;

/** Cantidad positiva con hasta 3 decimales ("2", "1,5"); null si no es válida. */
function parseQty(text: string): number | null {
  const n = text.trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(n)) return null;
  const value = Number(n);
  return value > 0 ? value : null;
}

const formatQty = (n: number) => new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 }).format(n);

/**
 * Inventario del local, pensado para tablet o monitor: botones grandes, búsqueda, alertas de stock
 * bajo y un movimiento anotado por cada cambio (compra, merma, ajuste). Quien puede editar
 * (dueño y gerente) además crea artículos e importa o exporta con Excel/CSV; cocina solo ajusta stock.
 */
export function InventoryManager() {
  const restaurant = useRestaurant();
  const { role } = usePanel();
  const { format } = usePricing();
  const canEdit = can(role, "inventory.edit");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<{ id: string; reason: "compra" | "merma" | "ajuste" } | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("inventory_items")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("category")
          .order("name"),
      ),
    [restaurant.id],
  );
  const { data: items, error: loadError, reload } = useAsyncLoad(loader);

  const categories = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.category))), [items]);
  const lowCount = (items ?? []).filter((i) => i.active && isLow(i)).length;
  const value = (items ?? []).reduce((sum, i) => sum + Math.round(Math.max(i.stock, 0) * i.cost_cents), 0);

  const visible = (items ?? []).filter((i) => {
    if (category && i.category !== category) return false;
    if (onlyLow && !isLow(i)) return false;
    const q = query.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.sku.includes(q);
  });

  async function adjust(item: Item, reason: "compra" | "merma" | "ajuste", delta: number, note: string) {
    const { error } = await getSupabase().rpc("adjust_inventory", {
      p_item_id: item.id,
      p_delta: delta,
      p_reason: reason,
      p_note: note || undefined,
    });
    setError(error ? describeError(error.message) : null);
    if (!error) setAdjusting(null);
    await reload();
  }

  async function save(row: Record<string, string>) {
    const { data, error } = await getSupabase().rpc("import_inventory", {
      p_restaurant_id: restaurant.id,
      p_rows: [row],
      p_source: "panel",
    });
    const failure = error?.message ?? (data as { errors: { message: string }[] }).errors[0]?.message;
    setError(failure ? describeError(failure) : null);
    if (!failure) {
      setAdding(false);
      setEditingId(null);
    }
    await reload();
  }

  async function remove(item: Item) {
    if (!window.confirm(`¿Eliminar "${item.name}" y todo su historial? No se puede deshacer.`)) return;
    const { error } = await getSupabase().from("inventory_items").delete().eq("id", item.id);
    setError(error ? describeError(error.message) : null);
    await reload();
  }

  const shownError = error ?? loadError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        {canEdit && !adding && (
          <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
            Añadir artículo
          </button>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {shownError}
        </p>
      )}

      {items && (
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className={cardClass}>
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted">artículos</p>
          </div>
          <button
            type="button"
            aria-pressed={onlyLow}
            onClick={() => setOnlyLow(!onlyLow)}
            className={`${cardClass} ${onlyLow ? "border-tomato" : ""}`}
          >
            <p className={`text-2xl font-bold ${lowCount > 0 ? "text-tomato" : ""}`}>{lowCount}</p>
            <p className="text-xs text-muted">stock bajo (tocar para filtrar)</p>
          </button>
          <div className={cardClass}>
            <p className="text-2xl font-bold">{format(value)}</p>
            <p className="text-xs text-muted">valor al costo (sin IVA)</p>
          </div>
        </div>
      )}

      {canEdit && items && (
        <ImportExport
          kind="inventory"
          existingKeys={new Set(items.map((i) => i.sku))}
          exportRows={() =>
            items.map((i) => [i.sku, i.name, i.category, i.unit, i.stock, i.min_stock, i.cost_cents / 100, i.active ? "si" : "no"])
          }
          onImported={() => void reload()}
        />
      )}

      {adding && (
        <div className={`${cardClass} mb-4`}>
          <h2 className="mb-3 font-semibold">Nuevo artículo</h2>
          <ItemForm categories={categories} onSubmit={save} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="inv-search">
          Buscar artículo
        </label>
        <input
          id="inv-search"
          type="search"
          placeholder="Buscar por nombre o código…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} max-w-sm`}
        />
        <label className="sr-only" htmlFor="inv-category">
          Categoría
        </label>
        <select
          id="inv-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 rounded-xl border border-line bg-card px-3"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!items && !shownError && <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />}
      {items?.length === 0 && !adding && (
        <p className="py-10 text-center text-muted">
          Tu inventario está vacío.{canEdit ? " Añade un artículo o importa un archivo de Excel." : ""}
        </p>
      )}
      {items && items.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-muted">Ningún artículo coincide con el filtro.</p>
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((item) => (
          <li key={item.id} className={cardClass}>
            {editingId === item.id ? (
              <ItemForm
                initial={item}
                categories={categories}
                onSubmit={save}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${item.active ? "" : "text-muted line-through"}`}>{item.name}</p>
                    <p className="truncate text-sm text-muted">
                      {item.category} · {item.sku} · costo {format(item.cost_cents)}/{item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${isLow(item) ? "text-tomato" : ""}`}>
                      {formatQty(item.stock)} {item.unit}
                    </p>
                    {item.min_stock > 0 && (
                      <p className="text-xs text-muted">
                        {isLow(item) ? "⚠ Bajo · " : ""}mínimo {formatQty(item.min_stock)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={smallButton} onClick={() => setAdjusting({ id: item.id, reason: "compra" })}>
                    + Compra
                  </button>
                  <button type="button" className={smallButton} onClick={() => setAdjusting({ id: item.id, reason: "merma" })}>
                    − Merma
                  </button>
                  <button type="button" className={smallButton} onClick={() => setAdjusting({ id: item.id, reason: "ajuste" })}>
                    Ajustar
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => setHistoryId(historyId === item.id ? null : item.id)}
                  >
                    {historyId === item.id ? "Ocultar historial" : "Historial"}
                  </button>
                  {canEdit && (
                    <>
                      <button type="button" className={smallButton} onClick={() => setEditingId(item.id)}>
                        Editar
                      </button>
                      <button type="button" className={`${smallButton} text-red-600`} onClick={() => void remove(item)}>
                        Eliminar
                      </button>
                    </>
                  )}
                </div>

                {adjusting?.id === item.id && (
                  <AdjustForm
                    item={item}
                    reason={adjusting.reason}
                    onSubmit={(delta, note) => adjust(item, adjusting.reason, delta, note)}
                    onCancel={() => setAdjusting(null)}
                  />
                )}
                {historyId === item.id && <History itemId={item.id} unit={item.unit} />}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Suma o resta una cantidad (compra suma, merma resta) o fija el stock contado (ajuste). */
function AdjustForm({
  item,
  reason,
  onSubmit,
  onCancel,
}: {
  item: Item;
  reason: "compra" | "merma" | "ajuste";
  onSubmit: (delta: number, note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const qty = reason === "ajuste" ? parseQtyAllowZero(amount) : parseQty(amount);
    if (qty === null) {
      setFormError("Escribe una cantidad válida, por ejemplo 2 o 1,5");
      return;
    }
    // «Ajustar» recibe el stock contado y calcula la diferencia contra el actual.
    const delta = reason === "compra" ? qty : reason === "merma" ? -qty : qty - item.stock;
    if (delta === 0) {
      setFormError("Ese ya es el stock actual");
      return;
    }
    setFormError(null);
    setBusy(true);
    await onSubmit(Math.round(delta * 1000) / 1000, note.trim());
    setBusy(false);
  }

  const label =
    reason === "compra" ? "Cantidad que entra" : reason === "merma" ? "Cantidad perdida o desechada" : "Stock contado ahora";

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className="text-sm font-medium" htmlFor={`qty-${item.id}`}>
          {label} ({item.unit})
        </label>
        <input
          id={`qty-${item.id}`}
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor={`note-${item.id}`}>
          Nota (opcional)
        </label>
        <input id={`note-${item.id}`} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          Guardar
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-3">
          {formError}
        </p>
      )}
    </form>
  );
}

/** Como parseQty pero acepta 0 (contar «cero» es un ajuste válido). */
function parseQtyAllowZero(text: string): number | null {
  const n = text.trim().replace(",", ".");
  return /^\d{1,9}(\.\d{1,3})?$/.test(n) ? Number(n) : null;
}

/** Últimos movimientos de un artículo: quién, cuándo, cuánto y por qué. */
function History({ itemId, unit }: { itemId: string; unit: string }) {
  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("inventory_movements")
          .select("*")
          .eq("item_id", itemId)
          .order("created_at", { ascending: false })
          .limit(20),
      ),
    [itemId],
  );
  const { data, error } = useAsyncLoad<Movement[]>(loader);

  if (error) return <p className="mt-3 text-sm text-red-600">{error}</p>;
  if (!data) return <div className="mt-3 h-12 animate-pulse rounded-xl bg-line" aria-hidden="true" />;
  if (data.length === 0) return <p className="mt-3 text-sm text-muted">Sin movimientos todavía.</p>;
  return (
    <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
      {data.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span>
            <strong className={m.delta < 0 ? "text-tomato" : ""}>
              {m.delta > 0 ? "+" : ""}
              {formatQty(m.delta)} {unit}
            </strong>{" "}
            · {REASON_LABEL[m.reason] ?? m.reason}
            {m.source !== "panel" && ` (${m.source})`}
            {m.note && <span className="text-muted"> — {m.note}</span>}
          </span>
          <span className="text-xs text-muted">
            queda {formatQty(m.stock_after)} · {new Date(m.created_at).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Alta o edición de un artículo. Al editar no se toca el stock: eso va por compra, merma o ajuste. */
function ItemForm({
  initial,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: Item;
  categories: string[];
  onSubmit: (row: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? "General");
  const [unit, setUnit] = useState(initial?.unit ?? "u");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState(initial ? String(initial.min_stock) : "0");
  const [cost, setCost] = useState(initial ? (initial.cost_cents / 100).toFixed(2) : "0");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const costCents = parsePriceToCents(cost);
    const min = parseQtyAllowZero(minStock);
    const initialStock = parseQtyAllowZero(stock);
    if (costCents === null) return setFormError("Escribe un costo válido, por ejemplo 6.80");
    if (min === null) return setFormError("El stock mínimo debe ser un número");
    if (!initial && initialStock === null) return setFormError("El stock inicial debe ser un número");

    setFormError(null);
    setBusy(true);
    await onSubmit({
      // Al editar el código ya existe y es la clave; al crear, si se deja vacío sale del nombre.
      ...(initial ? { sku: initial.sku } : sku.trim() ? { sku: sku.trim() } : {}),
      name: name.trim(),
      category: category.trim(),
      unit,
      min_stock: String(min),
      cost: String(costCents / 100),
      active: active ? "si" : "no",
      ...(initial ? {} : { stock: String(initialStock) }),
    });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor="i-name">
          Nombre
        </label>
        <input id="i-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="i-sku">
          Código (sku){initial ? "" : " — opcional"}
        </label>
        <input
          id="i-sku"
          maxLength={60}
          disabled={Boolean(initial)}
          placeholder="se genera del nombre"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className={`${inputClass} disabled:opacity-60`}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="i-cat">
          Categoría
        </label>
        <input id="i-cat" required maxLength={40} list="i-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
        <datalist id="i-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="i-unit">
          Unidad
        </label>
        <select id="i-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {!initial && (
        <div>
          <label className="text-sm font-medium" htmlFor="i-stock">
            Stock inicial
          </label>
          <input id="i-stock" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
        </div>
      )}
      <div>
        <label className="text-sm font-medium" htmlFor="i-min">
          Stock mínimo (avisa al llegar)
        </label>
        <input id="i-min" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="i-cost">
          Costo por unidad (sin IVA)
        </label>
        <input id="i-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5" />
        Artículo activo
      </label>
      {formError && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {formError}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {initial ? "Guardar" : "Añadir"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
