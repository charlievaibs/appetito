"use client";

import { useState, type FormEvent } from "react";
import type { Identification, OrderingMode } from "@/lib/db";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton } from "./styles";

const MODES: { value: OrderingMode; title: string; text: string }[] = [
  {
    value: "staff",
    title: "Atendido",
    text: "Solo el personal toma los pedidos. El QR, si lo usas, muestra el menú pero no permite pedir. Ideal para restaurantes de mantel.",
  },
  {
    value: "qr_optional",
    title: "QR opcional",
    text: "El personal toma pedidos y los comensales también pueden pedir escaneando un QR discreto.",
  },
  {
    value: "qr",
    title: "QR completo",
    text: "Los comensales piden solos desde su móvil. Ideal para locales casuales, bares y terrazas.",
  },
];

const IDENTIFICATIONS: { value: Identification; title: string; text: string }[] = [
  {
    value: "table",
    title: "Por mesa",
    text: "Cada pedido se asocia a la mesa. El comensal puede indicar su puesto o su nombre si quiere.",
  },
  {
    value: "seat",
    title: "Por puesto",
    text: "Cada pedido se asocia a un puesto concreto, útil para dividir la cuenta por persona.",
  },
  {
    value: "reservation",
    title: "Por reserva",
    text: "Las mesas llevan el nombre de quien reservó y los pedidos se agrupan alrededor de ese referente.",
  },
];

export function SettingsForm() {
  const restaurant = useRestaurant();
  const { reload } = usePanel();
  const [name, setName] = useState(restaurant.name);
  const [mode, setMode] = useState(restaurant.ordering_mode as OrderingMode);
  const [identification, setIdentification] = useState(restaurant.identification as Identification);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const { data, error } = await getSupabase()
      .from("restaurants")
      .update({ name: name.trim(), ordering_mode: mode, identification })
      .eq("id", restaurant.id)
      .select();
    setBusy(false);
    if (error) {
      setError(error.message);
    } else if (data.length === 0) {
      setError("Solo el dueño del restaurante puede cambiar los ajustes.");
    } else {
      setSaved(true);
      await reload();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>

      <div className={cardClass}>
        <label htmlFor="s-name" className="text-sm font-medium">
          Nombre del restaurante
        </label>
        <input
          id="s-name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <fieldset className={cardClass}>
        <legend className="px-1 font-semibold">¿Cómo se piden los platos?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {MODES.map((m) => (
            <Option
              key={m.value}
              name="mode"
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              title={m.title}
              text={m.text}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className={cardClass}>
        <legend className="px-1 font-semibold">¿Cómo se identifica a cada comensal?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {IDENTIFICATIONS.map((i) => (
            <Option
              key={i.value}
              name="identification"
              checked={identification === i.value}
              onChange={() => setIdentification(i.value)}
              title={i.title}
              text={i.text}
            />
          ))}
        </div>
      </fieldset>

      <div>
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Guardando…" : "Guardar ajustes"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-2 text-sm text-green-600">
            Ajustes guardados.
          </p>
        )}
      </div>
    </form>
  );
}

function Option({
  name,
  checked,
  onChange,
  title,
  text,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  text: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
        checked ? "border-tomato bg-tomato/5" : "border-line hover:bg-line/50"
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}
