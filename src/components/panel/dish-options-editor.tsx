"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { OptionGroup } from "@/lib/db";
import { parsePriceToCents } from "@/lib/money";
import { usePricing } from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";
import { inputClass, smallButton } from "./styles";

/**
 * Extras y opciones de un plato (quitar ingredientes, términos, adicionales con precio…). Los precios se
 * escriben SIN IVA. Cada opción puede mostrarse al comensal (extras básicos) o quedar solo para que el mesero
 * la agregue al tomar el pedido; así el dueño o gerente decide cuántos extras ve el cliente.
 */
export function DishOptionsEditor({ dishId }: { dishId: string }) {
  const { format } = usePricing();
  const [error, setError] = useState<string | null>(null);

  const loader = useCallback(
    async () =>
      unwrap(
        await getSupabase()
          .from("dish_option_groups")
          .select("*, dish_options(*)")
          .eq("dish_id", dishId)
          .order("position"),
      ) as OptionGroup[],
    [dishId],
  );
  const { data: groups, error: loadError, reload } = useAsyncLoad(loader);

  /** Ejecuta un cambio, muestra el error si lo hay y recarga. */
  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await action;
    setError(error ? error.message : null);
    await reload();
  }

  const supabase = getSupabase();

  async function addGroup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const position = Math.max(0, ...(groups ?? []).map((g) => g.position)) + 1;
    await run(
      supabase.from("dish_option_groups").insert({
        dish_id: dishId,
        name,
        kind: String(form.get("kind")) === "single" ? "single" : "multiple",
        required: form.get("required") === "on",
        position,
      }),
    );
    e.currentTarget.reset();
  }

  async function addOption(group: OptionGroup, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const priceText = String(form.get("price") ?? "").trim();
    const price = priceText === "" ? 0 : parsePriceToCents(priceText);
    if (!name || price === null) {
      setError("Escribe el nombre y un precio válido (por ejemplo 1.50) o déjalo vacío si es gratis.");
      return;
    }
    const position = Math.max(0, ...group.dish_options.map((o) => o.position)) + 1;
    await run(
      supabase.from("dish_options").insert({
        group_id: group.id,
        name,
        price_delta_cents: price,
        diner_visible: form.get("visible") === "on",
        position,
      }),
    );
    e.currentTarget.reset();
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-background p-3">
      <p className="text-sm text-muted">
        Los precios de los extras van <strong>sin IVA</strong>. Marca «Visible al comensal» en los extras básicos que quieras
        mostrar; los demás los agrega el mesero con su precio.
      </p>
      {(error ?? loadError) && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error ?? loadError}
        </p>
      )}
      {!groups && !loadError && <div className="mt-2 h-16 animate-pulse rounded-xl bg-card" aria-hidden="true" />}

      {groups?.map((group) => (
        <section key={group.id} className="mt-3 rounded-xl border border-line bg-card p-3" aria-label={group.name}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">
              {group.name}{" "}
              <span className="text-xs font-normal text-muted">
                {group.kind === "single" ? "elegir uno" : "elegir varios"}
                {group.required ? " · obligatorio" : ""}
              </span>
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={smallButton}
                onClick={() => void run(supabase.from("dish_option_groups").update({ required: !group.required }).eq("id", group.id))}
              >
                {group.required ? "Hacer opcional" : "Hacer obligatorio"}
              </button>
              <button
                type="button"
                className={smallButton}
                onClick={() => void run(supabase.from("dish_options").update({ diner_visible: true }).eq("group_id", group.id))}
              >
                Mostrar todos al comensal
              </button>
              <button
                type="button"
                className={`${smallButton} text-red-600`}
                onClick={() => {
                  if (window.confirm(`¿Eliminar el grupo «${group.name}» y sus opciones?`)) {
                    void run(supabase.from("dish_option_groups").delete().eq("id", group.id));
                  }
                }}
              >
                Eliminar grupo
              </button>
            </div>
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {group.dish_options
              .toSorted((a, b) => a.position - b.position)
              .map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-1 text-sm hover:bg-line/50">
                  <span className={`flex-1 ${o.available ? "" : "text-muted line-through"}`}>
                    {o.name}
                    {o.price_delta_cents > 0 && <span className="text-muted"> · +{format(o.price_delta_cents)}</span>}
                  </span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={o.diner_visible}
                      onChange={(e) => void run(supabase.from("dish_options").update({ diner_visible: e.target.checked }).eq("id", o.id))}
                    />
                    Visible al comensal
                  </label>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => void run(supabase.from("dish_options").update({ available: !o.available }).eq("id", o.id))}
                  >
                    {o.available ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 underline"
                    onClick={() => void run(supabase.from("dish_options").delete().eq("id", o.id))}
                  >
                    Quitar
                  </button>
                </li>
              ))}
          </ul>

          <form onSubmit={(e) => void addOption(group, e)} className="mt-2 flex flex-wrap items-end gap-2">
            <input name="name" required maxLength={60} placeholder="Nombre (Queso extra)" aria-label="Nombre de la opción" className={`${inputClass} h-10 w-48 flex-1`} />
            <input name="price" inputMode="decimal" placeholder="Precio sin IVA" aria-label="Precio sin IVA" className={`${inputClass} h-10 w-32`} />
            <label className="flex h-10 items-center gap-1 text-xs">
              <input type="checkbox" name="visible" defaultChecked />
              Visible al comensal
            </label>
            <button type="submit" className={smallButton}>
              Añadir opción
            </button>
          </form>
        </section>
      ))}

      <form onSubmit={(e) => void addGroup(e)} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <input name="name" required maxLength={60} placeholder="Nuevo grupo (Extras, Término…)" aria-label="Nombre del grupo" className={`${inputClass} h-10 w-56 flex-1`} />
        <select name="kind" aria-label="Tipo de elección" className="h-10 rounded-xl border border-line bg-card px-3 text-sm">
          <option value="multiple">Elegir varios (extras)</option>
          <option value="single">Elegir uno</option>
        </select>
        <label className="flex h-10 items-center gap-1 text-xs">
          <input type="checkbox" name="required" />
          Obligatorio
        </label>
        <button type="submit" className={smallButton}>
          Añadir grupo
        </button>
      </form>
    </div>
  );
}
