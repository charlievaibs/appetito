"use client";

import { useState, type FormEvent } from "react";
import type { ChangePolicy, Identification, ManualJoin, OrderingMode, TableSecurity } from "@/lib/db";
import { getCurrentCoordinates } from "@/lib/geo";
import { usePanel, useRestaurant } from "@/lib/panel-context";
import { parsePaymentMethods, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import { useBcvRates } from "@/lib/pricing";
import { describeRate, formatPriceFor, type PriceDisplay, type RateSource } from "@/lib/rates";
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

const MANUAL_JOINS: Choice<ManualJoin>[] = [
  {
    value: "open",
    title: "Libres entran directo",
    text: "El comensal elige su mesa y asiento en la app. Las mesas libres se toman al instante; las ocupadas o reservadas piden código o permiso del mesero.",
  },
  {
    value: "approval",
    title: "Con permiso del mesero",
    text: "Quien elige mesa a mano espera a que un mesero le dé acceso (o use un código). Evita que alguien se siente sin estar en el local.",
  },
  {
    value: "off",
    title: "Solo con NFC o QR",
    text: "No se puede elegir mesa a mano: hay que escanear o acercar el móvil a la etiqueta de la mesa.",
  },
];

const SECURITIES: Choice<TableSecurity>[] = [
  {
    value: "casual",
    title: "Informal",
    text: "El QR o NFC de una mesa libre la abre solo. Esa mesa queda «por confirmar» y sus pedidos no llegan a cocina hasta que un mesero confirme que hay gente. Ideal para bares y terrazas.",
  },
  {
    value: "strict",
    title: "Estricto",
    text: "Solo el mesero abre las mesas (al sentar al grupo) y les muestra un QR que cambia cada pocos minutos. El QR fijo de la mesa nunca basta por sí solo.",
  },
];

const DISPLAYS: Choice<PriceDisplay>[] = [
  { value: "usd", title: "Solo dólares", text: "Los precios se muestran en dólares, como están guardados." },
  { value: "both", title: "Dólares y bolívares", text: "Cada precio se muestra en dólares y en bolívares a la tasa elegida. Es lo más claro para el cliente." },
  { value: "ves", title: "Solo bolívares", text: "Los precios se muestran únicamente en bolívares a la tasa elegida." },
];

const RATE_SOURCES: Choice<RateSource>[] = [
  { value: "bcv_usd", title: "BCV dólar (oficial)", text: "Se consulta sola al Banco Central de Venezuela y se actualiza durante el día." },
  { value: "bcv_eur", title: "BCV euro (oficial)", text: "Usa la tasa oficial del euro en bolívares, también consultada sola." },
  { value: "manual", title: "La pongo yo", text: "Tú escribes la tasa y la actualizas cuando quieras. Útil si tu local usa otra referencia." },
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
  const [manualJoin, setManualJoin] = useState(restaurant.manual_join as ManualJoin);
  const [security, setSecurity] = useState(restaurant.table_security as TableSecurity);
  const [display, setDisplay] = useState(restaurant.price_display as PriceDisplay);
  const [rateSource, setRateSource] = useState(restaurant.rate_source as RateSource);
  const [manualRate, setManualRate] = useState(restaurant.manual_rate?.toString() ?? "");
  const { rates: bcv } = useBcvRates();
  const [methods, setMethods] = useState<PaymentMethod[]>(parsePaymentMethods(restaurant.payment_methods));
  const [paymentInstructions, setPaymentInstructions] = useState(restaurant.payment_instructions ?? "");
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

    const manual = manualRate.trim() === "" ? null : Number(manualRate.trim().replace(",", "."));
    if (rateSource === "manual" && (manual === null || !Number.isFinite(manual) || manual <= 0)) {
      setError("Escribe una tasa válida en bolívares por dólar (por ejemplo 889,57).");
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
        manual_join: manualJoin,
        table_security: security,
        payment_methods: methods,
        payment_instructions: paymentInstructions.trim() || null,
        price_display: display,
        rate_source: rateSource,
        manual_rate: manual,
        // La fecha solo cambia si cambió la tasa: así se sabe de cuándo es.
        ...(manual !== (restaurant.manual_rate ?? null) ? { manual_rate_at: new Date().toISOString() } : {}),
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
        legend="¿Cómo se protege una mesa de quien no está en el local?"
        name="table-security"
        options={SECURITIES}
        value={security}
        onChange={setSecurity}
      />
      <Choices
        legend="¿Puede el comensal elegir su mesa sin escanear?"
        name="manual-join"
        options={MANUAL_JOINS}
        value={manualJoin}
        onChange={setManualJoin}
      />
      <Choices legend="¿Cómo se muestran los precios?" name="price-display" options={DISPLAYS} value={display} onChange={setDisplay} />
      {display !== "usd" && (
        <>
          <Choices legend="¿Qué tasa se usa para los bolívares?" name="rate-source" options={RATE_SOURCES} value={rateSource} onChange={setRateSource} />
          {rateSource === "manual" ? (
            <div className={cardClass}>
              <label htmlFor="s-rate" className="text-sm font-medium">
                Tasa: bolívares por dólar
              </label>
              <input
                id="s-rate"
                inputMode="decimal"
                placeholder="889,57"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">
                Recuerda actualizarla cuando cambie. Hoy el BCV publica: {bcv ? `dólar Bs ${bcv.usd.toLocaleString("es-VE")} · euro Bs ${bcv.eur.toLocaleString("es-VE")}` : "consultando…"}
              </p>
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
              {describeRate({ display, source: rateSource, manualRate: null, manualRateAt: null }, bcv) ??
                "No pudimos consultar al BCV ahora mismo; mientras tanto se mostrarán dólares. Puedes usar «La pongo yo»."}
              {bcv && (
                <>
                  {" "}
                  Ejemplo: un plato de $12,99 se verá{" "}
                  <strong className="text-foreground">
                    {formatPriceFor(1299, { display, source: rateSource, manualRate: null, manualRateAt: null }, rateSource === "bcv_eur" ? bcv.eur : bcv.usd)}
                  </strong>
                  .
                </>
              )}
            </p>
          )}
        </>
      )}
      <fieldset className={cardClass}>
        <legend className="px-1 font-semibold">¿Cómo pueden pagar tus clientes?</legend>
        <p className="text-sm text-muted">
          Los comensales verán estos métodos en su cuenta y avisarán cuál usarán; tu equipo confirma el pago. Appetito no cobra: solo lo
          registra. Si no marcas ninguno, se cobra en la mesa.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={methods.includes(m)}
                onChange={(e) => setMethods(e.target.checked ? [...methods, m] : methods.filter((x) => x !== m))}
              />
              {PAYMENT_METHOD_LABEL[m]}
            </label>
          ))}
        </div>
        <label htmlFor="s-pay-info" className="mt-4 block text-sm font-medium">
          Instrucciones de pago (opcional)
        </label>
        <textarea
          id="s-pay-info"
          rows={3}
          maxLength={500}
          placeholder="Pago móvil: Banco X · 0414-0000000 · V-12345678"
          value={paymentInstructions}
          onChange={(e) => setPaymentInstructions(e.target.value)}
          className={`${inputClass} h-auto py-2`}
        />
        <p className="mt-1 text-xs text-muted">Se muestran al comensal cuando elige pagar, por ejemplo los datos de tu pago móvil.</p>
      </fieldset>
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
