"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { DbDish } from "@/lib/db";
import { formatPrice, parsePriceToCents } from "@/lib/money";
import { useRestaurant } from "@/lib/panel-context";
import { slugify } from "@/lib/slug";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { cardClass, inputClass, primaryButton, secondaryButton, smallButton } from "./styles";

type DishValues = {
  name: string;
  category: string;
  price_cents: number;
  description: string;
  emoji: string;
};

export function MenuManager() {
  const restaurant = useRestaurant();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("dishes")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("position")
          .order("name"),
      ),
    [restaurant.id],
  );
  const { data: dishes, error: loadError, reload } = useAsyncLoad(loader);

  const categories = Array.from(new Set((dishes ?? []).map((d) => d.category)));

  async function addDish(values: DishValues) {
    const taken = new Set((dishes ?? []).map((d) => d.slug));
    const base = slugify(values.name) || "plato";
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const position = Math.max(0, ...(dishes ?? []).map((d) => d.position)) + 1;

    const { error } = await getSupabase()
      .from("dishes")
      .insert({ restaurant_id: restaurant.id, slug, position, ...values });
    setError(error ? error.message : null);
    if (!error) setAdding(false);
    await reload();
  }

  async function updateDish(id: string, values: Partial<DbDish>) {
    const { error } = await getSupabase().from("dishes").update(values).eq("id", id);
    setError(error ? error.message : null);
    if (!error) setEditingId(null);
    await reload();
  }

  async function deleteDish(dish: DbDish) {
    if (!window.confirm(`¿Eliminar "${dish.name}" del menú?`)) return;
    const { error } = await getSupabase().from("dishes").delete().eq("id", dish.id);
    setError(error ? error.message : null);
    await reload();
  }

  const shownError = error ?? loadError;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Menú</h1>
        {!adding && (
          <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
            Añadir plato
          </button>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {shownError}
        </p>
      )}

      {adding && (
        <div className={`${cardClass} mb-4`}>
          <h2 className="mb-3 font-semibold">Nuevo plato</h2>
          <DishForm
            categories={categories}
            submitLabel="Añadir"
            onSubmit={addDish}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {!dishes && !shownError && (
        <div className="h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />
      )}
      {dishes?.length === 0 && !adding && (
        <p className="py-10 text-center text-muted">Tu menú está vacío. Añade el primer plato.</p>
      )}

      {categories.map((category) => (
        <section key={category} className="mb-6" aria-label={category}>
          <h2 className="mb-2 font-semibold text-muted">{category}</h2>
          <ul className="flex flex-col gap-2">
            {dishes
              ?.filter((d) => d.category === category)
              .map((d) => (
                <li key={d.id} className={cardClass}>
                  {editingId === d.id ? (
                    <DishForm
                      initial={d}
                      categories={categories}
                      submitLabel="Guardar"
                      onSubmit={(values) => updateDish(d.id, values)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-3xl" aria-hidden="true">
                        {d.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${d.available ? "" : "text-muted line-through"}`}>
                          {d.name}
                        </p>
                        <p className="truncate text-sm text-muted">{d.description}</p>
                      </div>
                      <span className="font-bold text-tomato">{formatPrice(d.price_cents)}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={smallButton}
                          onClick={() => void updateDish(d.id, { available: !d.available })}
                        >
                          {d.available ? "Pausar" : "Activar"}
                        </button>
                        <button type="button" className={smallButton} onClick={() => setEditingId(d.id)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${smallButton} text-red-600`}
                          onClick={() => void deleteDish(d)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DishForm({
  initial,
  categories,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: DbDish;
  categories: string[];
  submitLabel: string;
  onSubmit: (values: DishValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? "");
  const [price, setPrice] = useState(initial ? (initial.price_cents / 100).toFixed(2) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🍽️");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price_cents = parsePriceToCents(price);
    if (price_cents === null) {
      setFormError("Escribe un precio válido, por ejemplo 12.50");
      return;
    }
    setFormError(null);
    setBusy(true);
    await onSubmit({
      name: name.trim(),
      category: category.trim(),
      price_cents,
      description: description.trim(),
      emoji: emoji.trim() || "🍽️",
    });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium" htmlFor="d-name">
          Nombre
        </label>
        <input
          id="d-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="d-cat">
          Categoría
        </label>
        <input
          id="d-cat"
          required
          maxLength={40}
          list="d-cats"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        />
        <datalist id="d-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="d-price">
          Precio (USD)
        </label>
        <input
          id="d-price"
          required
          inputMode="decimal"
          placeholder="12.50"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="d-emoji">
          Emoji
        </label>
        <input
          id="d-emoji"
          maxLength={8}
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-sm font-medium" htmlFor="d-desc">
          Descripción
        </label>
        <input
          id="d-desc"
          maxLength={400}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>
      {formError && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-2">
          {formError}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
