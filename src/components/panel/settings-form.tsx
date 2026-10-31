"use client";

import { useState, type FormEvent } from "react";
import type { ChangePolicy, Identification, OrderingMode } from "@/lib/db";
import { getCurrentCoordinates } from "@/lib/geo";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { getSupabase } from "@/lib/supabase";
import { cardClass, inputClass, primaryButton, smallButton } from "./styles";

type Choice<T extends string> = { value: T; title: string; text: string };

const MODES: Choice<OrderingMode>[] = [
  {
    value: "staff",
    title: "Atendido",
    text: "Solo el personal toma los pedidos. Los comensales ven el menú pero no piden. Ideal para restaurantes de mantel.",
  },
  {
    value: "qr_optional",
    title: "NFC/QR opcional",
    text: "El personal toma pedidos y los comensales también pueden pedir y ajustar sus platos desde el móvil.",
  },
  {
    value: "qr",
    title: "NFC/QR completo",
    text: "Los comensales piden solos desde su móvil. Ideal para locales casuales, bares y terrazas.",
  },
];

const IDENTIFICATIONS: Choice<Identification>[] = [
  {
    value: "table",
    title: "Por mesa",
    text: "Cada plato se asocia a la mesa. El comensal puede indicar su puesto o su nombre si quiere.",
  },
  {
    value: "seat",
    title: "Por puesto",
    text: "Cada plato se asocia a un puesto concreto, útil para dividir la cuenta por persona.",
  },
  {
    value: "reservation",
    title: "Por reserva",
    text: "Las mesas llevan el nombre de quien reservó y los pedidos se agrupan alrededor de ese referente.",
  },
];

const POLICIES: Choice<ChangePolicy>[] = [
  {
    value: "before_kitchen",
    title: "Hasta que cocina empiece",
    text: "El comensal y el mesero pueden cambiar un plato mientras esté esperando. Es lo más seguro para cocina.",
  },
  {
    value: "until_ready",
    title: "Hasta que esté listo",
    text: "También se puede cambiar mientras se prepara; cocina ve el plato marcado como modificado.",
  },
];

/** Ajustes del restaurante: cómo se pide, cómo se identifica a cada comensal y su perfil público. */
export function SettingsForm() {
  const restaurant = useRestaurant();
  const { reload } = usePanel();
  const [name, setName] = useState(restaurant.name);
  const [mode, setMode] = useState(restaurant.ordering_mode as OrderingMode);
  const [identification, setIdentification] = useState(restaurant.identification as Identification);
  const [policy, setPolicy] = useState(restaurant.change_policy as ChangePolicy);
  const [listed, setListed] = useState(restaurant.listed);
  const [description, setDescription] = useState(restaurant.description);
  const [city, setCity] = useState(restaurant.city ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [latitude, setLatitude] = useState(restaurant.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(restaurant.longitude?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Rellena latitud y longitud con la ubicación del dispositivo (útil si se configura desde el local). */
  async function fillMyLocation() {
    setError(null);
    try {
      const { lat, lng } = await getCurrentCoordinates();
      setLatitude(lat.toFixed(6));
      setLongitude(lng.toFixed(6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos obtener tu ubicación.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lat = latitude.trim() === "" ? null : Number(latitude);
    const lng = longitude.trim() === "" ? null : Number(longitude);
    if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lng !== null && !(lng >= -180 && lng <= 180))) {
      setError("La ubicación no es válida: latitud entre -90 y 90, longitud entre -180 y 180.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    const { data, error } = await getSupabase()
      .from("restaurants")
      .update({
        name: name.trim(),
        ordering_mode: mode,
        identification,
        change_policy: policy,
        listed,
        description: description.trim(),
        city: city.trim() || null,
        address: address.trim() || null,
        latitude: lat,
        longitude: lng,
      })
      .eq("id", restaurant.id)
      .select();
    setBusy(false);
    if (error) {
      setError(error.message);
    } else if (data.length === 0) {
      // La política de seguridad solo deja modificar al dueño y no devuelve error, solo 0 filas.
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

      <Choices legend="¿Cómo se piden los platos?" name="mode" options={MODES} value={mode} onChange={setMode} />
      <Choices
        legend="¿Cómo se identifica a cada comensal?"
        name="identification"
        options={IDENTIFICATIONS}
        value={identification}
        onChange={setIdentification}
      />
      <Choices
        legend="¿Hasta cuándo se puede cambiar un plato?"
        name="policy"
        options={POLICIES}
        value={policy}
        onChange={setPolicy}
      />

      <fieldset className={cardClass}>
        <legend className="px-1 font-semibold">Perfil público</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
          Aparecer en el directorio de la app (los comensales podrán verte y consultar tu menú)
        </label>

        <label htmlFor="s-desc" className="mt-4 block text-sm font-medium">
          Descripción corta
        </label>
        <input
          id="s-desc"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="s-city" className="text-sm font-medium">
              Ciudad
            </label>
            <input id="s-city" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="s-address" className="text-sm font-medium">
              Dirección
            </label>
            <input
              id="s-address"
              maxLength={160}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="s-lat" className="text-sm font-medium">
              Latitud
            </label>
            <input
              id="s-lat"
              inputMode="decimal"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="s-lng" className="text-sm font-medium">
              Longitud
            </label>
            <input
              id="s-lng"
              inputMode="decimal"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <button type="button" onClick={() => void fillMyLocation()} className={`mt-3 ${smallButton}`}>
          📍 Usar mi ubicación actual
        </button>
        <p className="mt-1 text-xs text-muted">
          La ubicación sirve para ordenar el directorio por cercanía. Es opcional.
        </p>
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

/** Grupo de opciones excluyentes (botones de radio) con título y explicación. */
function Choices<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={cardClass}>
      <legend className="px-1 font-semibold">{legend}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
              value === o.value ? "border-tomato bg-tomato/5" : "border-line hover:bg-line/50"
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{o.title}</span>
              <span className="block text-sm text-muted">{o.text}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
