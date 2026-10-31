"use client";

import { useSyncExternalStore } from "react";
import { dishes } from "@/data/menu";
import { countItems, totalCents } from "./cart";
import {
  dispatch,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "./cart-store";

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    lines,
    itemCount: countItems(lines),
    totalCents: totalCents(lines, dishes),
    add: (dishId: string, quantity: number) =>
      dispatch({ type: "add", dishId, quantity }),
    setQuantity: (dishId: string, quantity: number) =>
      dispatch({ type: "setQuantity", dishId, quantity }),
    remove: (dishId: string) => dispatch({ type: "remove", dishId }),
    clear: () => dispatch({ type: "clear" }),
  };
}

const subscribeNoop = () => () => {};

/** false en el servidor y durante la hidratación; true ya en el navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
