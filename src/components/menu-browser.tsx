"use client";

import { useState } from "react";
import type { Dish } from "@/lib/types";
import { DishCard } from "./dish-card";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function MenuBrowser({
  dishes,
  categories,
}: {
  dishes: Dish[];
  categories: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const needle = normalize(query.trim());
  const visible = dishes.filter(
    (d) =>
      (category === null || d.category === category) &&
      (needle === "" ||
        normalize(d.name).includes(needle) ||
        normalize(d.description).includes(needle)),
  );

  return (
    <div>
      <label htmlFor="buscar" className="sr-only">
        Buscar en el menú
      </label>
      <input
        id="buscar"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca un plato…"
        className="h-12 w-full rounded-full border border-line bg-card px-5 outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/30"
      />

      <div className="mt-4 flex flex-wrap gap-2">
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
        <p className="mt-10 text-center text-muted">
          No encontramos platos con esa búsqueda.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
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
        active
          ? "border-tomato bg-tomato text-white"
          : "border-line bg-card hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
