"use client";

import Link from "next/link";
import { useState } from "react";
import { getDish } from "@/data/menu";
import { formatPrice } from "@/lib/money";
import { useCart, useHydrated } from "@/lib/use-cart";
import { QuantityStepper } from "./quantity-stepper";

type Confirmation = { items: number; totalCents: number };

export function CartView() {
  const hydrated = useHydrated();
  const { lines, itemCount, totalCents, setQuantity, remove, clear } = useCart();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
        <div className="text-5xl" aria-hidden="true">
          ✅
        </div>
        <h2 className="mt-4 text-2xl font-bold">¡Pedido recibido!</h2>
        <p className="mt-2 text-muted">
          {confirmation.items} {confirmation.items === 1 ? "unidad" : "unidades"} ·{" "}
          {formatPrice(confirmation.totalCents)}
        </p>
        <p className="mt-4 rounded-lg bg-tomato/10 px-3 py-2 text-sm text-muted">
          Esto es una demostración: por ahora el pedido no se envía a ningún
          restaurante.
        </p>
        <Link
          href="/menu"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
        >
          Volver al menú
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-5xl" aria-hidden="true">
          🛒
        </div>
        <p className="mt-4 text-lg text-muted">Tu carrito está vacío.</p>
        <Link
          href="/menu"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
        >
          Explorar el menú
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const dish = getDish(line.dishId);
          if (!dish) return null;
          return (
            <li
              key={line.dishId}
              className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4"
            >
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-tomato/10 text-3xl"
                aria-hidden="true"
              >
                {dish.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/menu/${dish.id}`}
                  className="block truncate font-semibold hover:text-tomato"
                >
                  {dish.name}
                </Link>
                <p className="text-sm text-muted">{formatPrice(dish.priceCents)} c/u</p>
                <div className="mt-2">
                  <QuantityStepper
                    value={line.quantity}
                    min={0}
                    onChange={(q) => setQuantity(dish.id, q)}
                    label={`Cantidad de ${dish.name}`}
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-bold text-tomato">
                  {formatPrice(dish.priceCents * line.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(dish.id)}
                  className="text-sm text-muted underline hover:text-foreground"
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-semibold">Resumen del pedido</h2>
        <dl className="mt-4 space-y-2">
          <div className="flex justify-between text-muted">
            <dt>Unidades</dt>
            <dd>{itemCount}</dd>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <dt>Total</dt>
            <dd className="text-tomato">{formatPrice(totalCents)}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            setConfirmation({ items: itemCount, totalCents });
            clear();
          }}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
        >
          Confirmar pedido
        </button>
      </aside>
    </div>
  );
}
