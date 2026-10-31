import Link from "next/link";
import { formatPrice } from "@/lib/money";
import type { Dish } from "@/lib/types";

export function DishCard({ dish }: { dish: Dish }) {
  return (
    <Link
      href={`/menu/${dish.id}`}
      className="flex flex-col rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="flex h-28 items-center justify-center rounded-xl bg-tomato/10 text-5xl"
        aria-hidden="true"
      >
        {dish.emoji}
      </div>
      <h3 className="mt-3 font-semibold leading-snug">{dish.name}</h3>
      <p className="mt-0.5 text-xs text-muted">{dish.category}</p>
      <p className="mt-2 font-bold text-tomato">{formatPrice(dish.priceCents)}</p>
    </Link>
  );
}
