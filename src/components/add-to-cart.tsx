"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/money";
import type { Dish } from "@/lib/types";
import { useCart } from "@/lib/use-cart";
import { QuantityStepper } from "./quantity-stepper";

export function AddToCart({ dish }: { dish: Dish }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="mt-8 flex flex-col gap-4">
      <QuantityStepper
        value={quantity}
        onChange={(q) => {
          setQuantity(q);
          setAdded(false);
        }}
        label={`Cantidad de ${dish.name}`}
      />

      <button
        type="button"
        onClick={() => {
          add(dish.id, quantity);
          setAdded(true);
        }}
        className="inline-flex h-12 items-center justify-center rounded-full bg-tomato px-6 font-semibold text-white transition-colors hover:bg-tomato-dark"
      >
        Agregar al carrito · {formatPrice(dish.priceCents * quantity)}
      </button>

      <p className="min-h-6 text-sm" role="status">
        {added && (
          <>
            <span className="text-green-600">¡Agregado!</span>{" "}
            <Link href="/carrito" className="font-semibold text-tomato underline">
              Ver carrito
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
