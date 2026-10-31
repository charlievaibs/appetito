"use client";

import { useState, type FormEvent } from "react";
import { usePanel } from "@/lib/panel-context";
import { slugify } from "@/lib/slug";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton, secondaryButton } from "./styles";

/**
 * Primer paso tras crear la cuenta: dar de alta el restaurante. Se hace con la
 * función `create_restaurant`, que además deja a esta persona como dueña.
 * El identificador (slug) se propone a partir del nombre y se puede cambiar.
 */
export function CreateRestaurant() {
  const { reload, signOut } = usePanel();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().rpc("create_restaurant", {
      p_name: name,
      p_slug: slug,
    });
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Ese identificador ya está en uso. Prueba con otro."
          : error.message,
      );
      return;
    }
    await reload();
  }

  return (
    <div className={`mx-auto mt-10 max-w-sm ${cardClass}`}>
      <h1 className="text-2xl font-bold tracking-tight">Crea tu restaurante</h1>
      <p className="mt-1 text-sm text-muted">
        Después podrás añadir tu menú, tus mesas y elegir cómo se piden los platos.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="name">
          Nombre del restaurante
        </label>
        <input
          id="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className={inputClass}
        />
        <label className="text-sm font-medium" htmlFor="slug">
          Identificador (para la dirección web)
        </label>
        <input
          id="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          title="Solo minúsculas, números y guiones"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !slug} className={`mt-2 ${primaryButton}`}>
          {busy ? "Creando…" : "Crear restaurante"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void signOut()}
        className={`mt-3 w-full ${secondaryButton}`}
      >
        Salir
      </button>
    </div>
  );
}
