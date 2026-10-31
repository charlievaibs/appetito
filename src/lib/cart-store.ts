import { cartReducer, parseStoredCart, type CartAction } from "./cart";
import type { CartLine } from "./types";

const STORAGE_KEY = "appetito:cart:v1";

export const EMPTY_CART: CartLine[] = [];

let cache: { raw: string | null; lines: CartLine[] } = {
  raw: null,
  lines: EMPTY_CART,
};
// Si el navegador bloquea localStorage, el carrito vive solo en memoria.
let storageWorks = true;
const listeners = new Set<() => void>();

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    storageWorks = false;
    return null;
  }
}

export function getSnapshot(): CartLine[] {
  if (!storageWorks) return cache.lines;
  const raw = readStorage();
  if (!storageWorks) return cache.lines;
  if (raw !== cache.raw) {
    const lines = parseStoredCart(raw);
    cache = { raw, lines: lines.length === 0 ? EMPTY_CART : lines };
  }
  return cache.lines;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY_CART;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function dispatch(action: CartAction): void {
  const next = cartReducer(getSnapshot(), action);
  const raw = next.length === 0 ? null : JSON.stringify(next);
  cache = { raw, lines: next.length === 0 ? EMPTY_CART : next };
  try {
    if (raw === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    storageWorks = false;
  }
  listeners.forEach((l) => l());
}
