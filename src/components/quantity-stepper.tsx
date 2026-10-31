"use client";

import { MAX_QUANTITY } from "@/lib/order-items";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Valor mínimo permitido (0 permite "quitar"). */
  min?: number;
  /** Nombre accesible del control, p. ej. "Cantidad de Pizza". */
  label: string;
};

const buttonClass =
  "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-lg font-semibold transition-colors hover:bg-line disabled:cursor-not-allowed disabled:opacity-40";

/** Selector de cantidad con botones − y +. */
export function QuantityStepper({ value, onChange, min = 1, label }: Props) {
  return (
    <div className="inline-flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Quitar una unidad"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label="Agregar una unidad"
      >
        +
      </button>
    </div>
  );
}
