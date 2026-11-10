/**
 * Recetas por plato: costo por porción y margen. El inventario guarda el costo por unidad (céntimos, sin IVA)
 * y la receta cuánto lleva UNA porción, así que el costo es la suma de cantidad × costo.
 */

export type RecipeLine = { item_id: string; quantity: number };
export type CostedItem = { id: string; cost_cents: number };

/** Costo de una porción en céntimos (sin IVA). Los artículos que ya no existen cuentan como 0. */
export function recipeCostCents(lines: RecipeLine[], items: Map<string, CostedItem>): number {
  const total = lines.reduce((sum, l) => sum + l.quantity * (items.get(l.item_id)?.cost_cents ?? 0), 0);
  return Math.round(total);
}

export type Margin = {
  /** Ganancia por porción en céntimos (precio sin IVA − costo). */
  cents: number;
  /** Porcentaje sobre el precio, redondeado; null si el precio es 0. */
  percent: number | null;
};

export function recipeMargin(priceCents: number, costCents: number): Margin {
  return {
    cents: priceCents - costCents,
    percent: priceCents > 0 ? Math.round(((priceCents - costCents) / priceCents) * 100) : null,
  };
}

/** Cantidad con hasta 3 decimales ("0,25" o "0.25"); null si no es un número mayor que cero. */
export function parseRecipeQuantity(text: string): number | null {
  const n = text.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,3})?$/.test(n)) return null;
  const value = Number(n);
  return value > 0 ? value : null;
}
