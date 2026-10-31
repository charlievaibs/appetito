/**
 * Reglas puras sobre los platos pedidos: totales, quién puede editar qué y
 * validación de opciones. No toca la red ni el navegador, así que se prueba
 * con tests. Estas reglas REPLICAN las de la base de datos (funciones
 * `add_items` y `update_item`) para dar respuesta inmediata en la interfaz;
 * la base de datos es siempre la que decide de verdad.
 */
import type { ChangePolicy, ItemStatus, OptionGroup, OrderItem, OrderingMode } from "./db";
import type { Json } from "./database.types";

/** Máximo de unidades de un mismo plato en una línea (igual que en la base de datos). */
export const MAX_QUANTITY = 20;

/** Una opción elegida, tal como se guarda (copia) en el plato pedido. */
export type ChosenOption = { group: string; name: string; price_delta_cents: number };

export const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Esperando",
  preparing: "En preparación",
  ready: "Listo",
  served: "Servido",
  cancelled: "Cancelado",
};

/** Lee el JSON de opciones guardado en un plato; descarta lo que no tenga la forma esperada. */
export function parseOptions(value: Json): ChosenOption[] {
  if (!Array.isArray(value)) return [];
  const result: ChosenOption[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { group, name, price_delta_cents } = entry;
    if (typeof group === "string" && typeof name === "string" && typeof price_delta_cents === "number") {
      result.push({ group, name, price_delta_cents });
    }
  }
  return result;
}

/** Total de una línea (precio unitario con opciones × cantidad). */
export function lineTotalCents(item: Pick<OrderItem, "unit_price_cents" | "quantity">): number {
  return item.unit_price_cents * item.quantity;
}

/** Suma de las líneas que cuentan (los platos cancelados no se cobran). */
export function itemsTotalCents(
  items: Pick<OrderItem, "unit_price_cents" | "quantity" | "status">[],
): number {
  return items
    .filter((i) => i.status !== "cancelled")
    .reduce((sum, i) => sum + lineTotalCents(i), 0);
}

/** ¿Se puede cambiar un plato en este estado según la política del restaurante? */
export function isEditableStatus(status: string, policy: ChangePolicy): boolean {
  return status === "pending" || (status === "preparing" && policy === "until_ready");
}

export type EditContext = {
  userId: string;
  /** Puesto del comensal en la mesa, si lo indicó. */
  seatId: string | null;
  orderingMode: OrderingMode;
  policy: ChangePolicy;
};

/**
 * ¿Es un plato "mío"? Lo es si lo pidió este comensal, o si pertenece a su puesto
 * (por ejemplo, lo pidió el mesero para esa silla).
 */
export function isOwnItem(
  item: Pick<OrderItem, "added_by" | "seat_id">,
  userId: string,
  seatId: string | null,
): boolean {
  return item.added_by === userId || (item.seat_id !== null && item.seat_id === seatId);
}

/**
 * ¿Puede este comensal editar el plato? Debe ser suyo, el restaurante debe
 * permitir que los comensales pidan y el plato aún debe estar en una etapa editable.
 */
export function canDinerEdit(
  item: Pick<OrderItem, "added_by" | "seat_id" | "status">,
  ctx: EditContext,
): boolean {
  if (ctx.orderingMode === "staff") return false;
  return isOwnItem(item, ctx.userId, ctx.seatId) && isEditableStatus(item.status, ctx.policy);
}

/**
 * Comprueba las opciones elegidas contra las reglas de cada grupo:
 * "single" admite una sola, "required" exige al menos una.
 * Devuelve el mensaje del primer problema, o null si todo está bien.
 */
export function validateSelection(groups: OptionGroup[], selectedIds: string[]): string | null {
  const selected = new Set(selectedIds);
  for (const group of groups) {
    const count = group.dish_options.filter((o) => selected.has(o.id)).length;
    if (group.kind === "single" && count > 1) {
      return `En "${group.name}" solo puedes elegir una opción.`;
    }
    if (group.required && count === 0) {
      return `Elige una opción en "${group.name}".`;
    }
  }
  return null;
}

/** Sobreprecio por unidad de las opciones elegidas. */
export function optionsDeltaCents(groups: OptionGroup[], selectedIds: string[]): number {
  const selected = new Set(selectedIds);
  return groups
    .flatMap((g) => g.dish_options)
    .filter((o) => selected.has(o.id))
    .reduce((sum, o) => sum + o.price_delta_cents, 0);
}

/** Agrupa platos por una clave de texto conservando el orden de aparición. */
export function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()];
}
