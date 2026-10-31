"use client";

import { useState } from "react";
import type { DishWithOptions } from "@/lib/db";
import { formatPrice } from "@/lib/money";

/** Quita acentos y mayúsculas para que "pizza" encuentre "Pizzá". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type Props = {
  dishes: DishWithOptions[];
  /** Si se pasa, cada plato muestra un botón para elegirlo; si no, el menú es solo de lectura. */
  onPick?: (dish: DishWithOptions) => void;
  pickLabel?: string;
};

/**
 * Menú con búsqueda y filtro por categoría. Lo usan el comensal (para pedir),
 * el mesero (para tomar pedidos) y la página pública del restaurante (solo lectura).
 */
export function MenuList({ dishes, onPick, pickLabel = "Agregar" }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(dishes.map((d) => d.category)));
  const needle = normalize(query.trim());
  const visible = dishes.filter(
    (d) =>
      (category === null || d.category === category) &&
      (needle === "" || normalize(d.name).includes(needle) || normalize(d.description).includes(needle)),
  );

  return (
    <div>
      <label htmlFor="menu-search" className="sr-only">
        Buscar en el menú
      </label>
      <input
        id="menu-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca un plato…"
        className="h-11 w-full rounded-full border border-line bg-card px-5 outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/30"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={category === null} onClick={() => setCategory(null)}>
          Todo
        </Chip>
        {categories.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-muted">No encontramos platos con esa búsqueda.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((dish) => (
            <li
              key={dish.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
            >
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-tomato/10 text-3xl"
                aria-hidden="true"
              >
                {dish.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{dish.name}</p>
                <p className="line-clamp-2 text-sm text-muted">{dish.description}</p>
                <p className="mt-1 font-bold text-tomato">{formatPrice(dish.price_cents)}</p>
              </div>
              {onPick && (
                <button
                  type="button"
                  onClick={() => onPick(dish)}
                  className="inline-flex h-10 shrink-0 items-center rounded-full bg-tomato px-4 text-sm font-semibold text-white transition-colors hover:bg-tomato-dark"
                  aria-label={`${pickLabel} ${dish.name}`}
                >
                  {pickLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
        active ? "border-tomato bg-tomato text-white" : "border-line bg-card hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
