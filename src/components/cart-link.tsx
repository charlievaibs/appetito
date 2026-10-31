"use client";

import Link from "next/link";
import { useCart } from "@/lib/use-cart";

export function CartLink() {
  const { itemCount } = useCart();

  return (
    <Link
      href="/carrito"
      className="relative inline-flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold transition-colors hover:bg-line"
      aria-label={
        itemCount > 0 ? `Carrito, ${itemCount} unidades` : "Carrito vacío"
      }
    >
      Carrito
      {itemCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-tomato px-1.5 text-xs font-bold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
