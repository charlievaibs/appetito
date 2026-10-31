import type { CartLine, Dish } from "./types";

export const MAX_PER_DISH = 20;

export type CartAction =
  | { type: "add"; dishId: string; quantity: number }
  | { type: "setQuantity"; dishId: string; quantity: number }
  | { type: "remove"; dishId: string }
  | { type: "clear" };

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_PER_DISH, Math.max(0, Math.floor(n)));
}

export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add": {
      const quantity = clamp(action.quantity);
      if (quantity === 0) return lines;
      if (!lines.some((l) => l.dishId === action.dishId)) {
        return [...lines, { dishId: action.dishId, quantity }];
      }
      return lines.map((l) =>
        l.dishId === action.dishId
          ? { ...l, quantity: clamp(l.quantity + quantity) }
          : l,
      );
    }
    case "setQuantity": {
      const quantity = clamp(action.quantity);
      if (quantity === 0) return lines.filter((l) => l.dishId !== action.dishId);
      return lines.map((l) =>
        l.dishId === action.dishId ? { ...l, quantity } : l,
      );
    }
    case "remove":
      return lines.filter((l) => l.dishId !== action.dishId);
    case "clear":
      return [];
  }
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function totalCents(lines: CartLine[], dishes: Dish[]): number {
  return lines.reduce((sum, l) => {
    const dish = dishes.find((d) => d.id === l.dishId);
    return dish ? sum + dish.priceCents * l.quantity : sum;
  }, 0);
}

/** Lee un carrito guardado; descarta cualquier dato inválido en vez de fallar. */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const lines: CartLine[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const { dishId, quantity } = item as Record<string, unknown>;
    if (typeof dishId !== "string" || typeof quantity !== "number") continue;
    const q = clamp(quantity);
    if (q === 0 || lines.some((l) => l.dishId === dishId)) continue;
    lines.push({ dishId, quantity: q });
  }
  return lines;
}
