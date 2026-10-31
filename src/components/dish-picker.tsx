"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DishWithOptions } from "@/lib/db";
import { usePricing } from "@/lib/pricing";
import { optionsDeltaCents, validateSelection } from "@/lib/order-items";
import { QuantityStepper } from "./quantity-stepper";

export type PickerValues = { quantity: number; optionIds: string[]; note: string };

type Props = {
  dish: DishWithOptions;
  /** Valores iniciales cuando se edita un plato ya pedido. */
  initial?: PickerValues;
  confirmLabel: string;
  onConfirm: (values: PickerValues) => Promise<void>;
  onCancel: () => void;
  /** Si se pasa, aparece un botón para quitar el plato del pedido. */
  onRemove?: () => Promise<void>;
};

/**
 * Ventana para personalizar un plato: cantidad, opciones (quitar ingredientes,
 * extras, término…) y una nota libre. Se usa para agregar y para editar, tanto
 * por el comensal como por el mesero.
 */
export function DishPicker({ dish, initial, confirmLabel, onConfirm, onCancel, onRemove }: Props) {
  const { formatMenu } = usePricing();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [selected, setSelected] = useState<string[]>(initial?.optionIds ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // <dialog> nativo: maneja el foco, la tecla Escape y el fondo oscuro por nosotros.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const groups = dish.dish_option_groups.toSorted((a, b) => a.position - b.position);
  const unitCents = dish.price_cents + optionsDeltaCents(groups, selected);

  function toggle(groupId: string, optionId: string, single: boolean) {
    const group = groups.find((g) => g.id === groupId);
    const siblings = new Set(group?.dish_options.map((o) => o.id));
    setSelected((prev) => {
      if (prev.includes(optionId)) return prev.filter((id) => id !== optionId);
      // En un grupo de elección única, elegir una opción reemplaza a la anterior.
      return [...(single ? prev.filter((id) => !siblings.has(id)) : prev), optionId];
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateSelection(groups, selected);
    if (problem) {
      setError(problem);
      return;
    }
    await run(() => onConfirm({ quantity, optionIds: selected, note: note.trim() }));
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      aria-labelledby="picker-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <form onSubmit={submit} className="flex max-h-[85vh] flex-col">
        <div className="overflow-y-auto p-6">
          <div className="flex items-start gap-3">
            <span className="text-4xl" aria-hidden="true">
              {dish.emoji}
            </span>
            <div>
              <h2 id="picker-title" className="text-xl font-bold leading-tight">
                {dish.name}
              </h2>
              <p className="mt-1 text-sm text-muted">{dish.description}</p>
            </div>
          </div>

          {groups.map((group) => (
            <fieldset key={group.id} className="mt-5">
              <legend className="font-semibold">
                {group.name}
                <span className="ml-2 text-xs font-normal text-muted">
                  {group.required ? "Obligatorio" : "Opcional"}
                  {group.kind === "single" ? " · elige una" : ""}
                </span>
              </legend>
              <div className="mt-2 flex flex-col gap-1">
                {group.dish_options
                  .toSorted((a, b) => a.position - b.position)
                  .map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 has-checked:border-tomato has-checked:bg-tomato/5"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type={group.kind === "single" ? "radio" : "checkbox"}
                          name={group.id}
                          checked={selected.includes(option.id)}
                          onChange={() => toggle(group.id, option.id, group.kind === "single")}
                        />
                        {option.name}
                      </span>
                      {option.price_delta_cents > 0 && formatMenu(option.price_delta_cents) !== null && (
                        <span className="text-sm text-muted">+{formatMenu(option.price_delta_cents)}</span>
                      )}
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}

          <label htmlFor="picker-note" className="mt-5 block font-semibold">
            Nota para cocina <span className="text-xs font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="picker-note"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Sin cebolla, bien cocida…"
            className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-tomato focus:ring-2 focus:ring-tomato/30"
          />

          <div className="mt-5">
            <QuantityStepper value={quantity} onChange={setQuantity} label={`Cantidad de ${dish.name}`} />
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4">
          {onRemove && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(onRemove)}
              className="text-sm text-red-600 underline disabled:opacity-50"
            >
              Quitar plato
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center rounded-full border border-line px-5 font-medium hover:bg-line"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center rounded-full bg-tomato px-5 font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
            >
              {confirmLabel}
              {formatMenu(unitCents * quantity) !== null && ` · ${formatMenu(unitCents * quantity)}`}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
