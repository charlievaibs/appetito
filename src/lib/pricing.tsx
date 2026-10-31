"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrderItem } from "./db";
import {
  describeRate,
  formatBase,
  formatPriceFor,
  formatVes,
  grossCents,
  parseBcvResponse,
  pickRate,
  USD_ONLY,
  type BcvRates,
  type PricingSettings,
} from "./rates";

type PricingValue = {
  /** Da formato a un precio en céntimos de dólar según cómo lo muestre el local. */
  format: (usdCents: number) => string;
  /** Qué tasa se está usando, para mostrarla en una nota; null si solo hay dólares. */
  rateNote: string | null;
  /**
   * Precio para mostrar en el MENÚ y en los platos pedidos. Es null cuando el restaurante decidió mostrar
   * los precios solo en la cuenta al cobrar (solo para comensales; el personal siempre los ve).
   */
  formatMenu: (usdCents: number) => string | null;
  /** Importe con IVA de un precio neto (los precios se guardan sin IVA). */
  gross: (netCents: number) => number;
  /** Total con IVA de los platos pedidos, formateado; null si el menú oculta precios (solo comensales). */
  formatTotal: (items: Pick<OrderItem, "unit_price_cents" | "quantity" | "status">[]) => string | null;
  /** IVA aplicado, en porcentaje, y si el menú lo muestra incluido. */
  vatPercent: number;
  pricesIncludeVat: boolean;
  /** Formatea un importe ya expresado en la moneda en que se cobra: la base con su etiqueta, o bolívares. */
  formatIn: (currency: "USD" | "VES", cents: number) => string;
  /** Bolívares por dólar que se aplican ahora (aunque el local muestre solo dólares), o null si no se conoce. */
  rate: number | null;
};

const PricingContext = createContext<PricingValue>({
  format: (cents) => formatPriceFor(cents, USD_ONLY, null),
  rateNote: null,
  rate: null,
  formatMenu: (cents) => formatPriceFor(cents, USD_ONLY, null),
  formatIn: (currency, cents) => (currency === "VES" ? formatVes(cents) : formatBase(cents, USD_ONLY.label)),
  gross: (net) => net,
  formatTotal: (items) => formatPriceFor(items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.unit_price_cents * i.quantity, 0), USD_ONLY, null),
  vatPercent: 0,
  pricesIncludeVat: false,
});

/** Tasa del BCV compartida por toda la página: se consulta una vez y se reutiliza unos minutos. */
let bcvPromise: Promise<BcvRates | null> | null = null;
let bcvAt = 0;
const BCV_TTL_MS = 10 * 60 * 1000;

function loadBcv(): Promise<BcvRates | null> {
  if (!bcvPromise || Date.now() - bcvAt > BCV_TTL_MS) {
    bcvAt = Date.now();
    bcvPromise = fetch("/api/tasas")
      .then((r) => (r.ok ? r.json() : null))
      .then(parseBcvResponse)
      .catch(() => null);
  }
  return bcvPromise;
}

/** Tasas del BCV (o null mientras cargan o si no están disponibles). Para pantallas de ajustes. */
export function useBcvRates(): { rates: BcvRates | null; loading: boolean } {
  const [state, setState] = useState<{ rates: BcvRates | null; loading: boolean }>({ rates: null, loading: true });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void loadBcv().then((rates) => active && setState({ rates, loading: false }));
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  return state;
}

/**
 * Define cómo se muestran los precios en todo lo que cuelga de aquí: en dólares, en bolívares o
 * en ambos, con la tasa que eligió el local. Si hace falta el BCV lo consulta una vez; mientras
 * llega (o si no responde) se muestran dólares, nunca un importe inventado.
 */
export function PricingProvider({
  settings,
  audience = "diner",
  children,
}: {
  settings: PricingSettings;
  /** "staff" para el panel: el personal ve siempre los precios aunque el menú del comensal los oculte. */
  audience?: "diner" | "staff";
  children: ReactNode;
}) {
  // Se consulta el BCV si el local lo usa, incluso mostrando solo dólares: caja necesita la tasa para cobrar en bolívares.
  const needsBcv = settings.source !== "manual";
  const [bcv, setBcv] = useState<BcvRates | null>(null);

  useEffect(() => {
    if (!needsBcv) return;
    let active = true;
    const timer = setTimeout(() => {
      void loadBcv().then((rates) => active && setBcv(rates));
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [needsBcv]);

  const value = useMemo<PricingValue>(() => {
    const rate = pickRate(settings, bcv);
    const shownRate = settings.display === "usd" ? null : rate;
    const hideInMenu = audience === "diner" && !settings.menuPricesVisible;
    return {
      format: (cents) => formatPriceFor(cents, settings, shownRate),
      formatIn: (currency, cents) => (currency === "VES" ? formatVes(cents) : formatBase(cents, settings.label)),
      // En el menú se muestra el precio con IVA si el local lo incluye; si no, el precio sin IVA (el IVA se suma en la cuenta).
      formatMenu: (cents) =>
        hideInMenu ? null : formatPriceFor(settings.pricesIncludeVat ? grossCents(cents, settings.vatPercent) : cents, settings, shownRate),
      gross: (net) => grossCents(net, settings.vatPercent),
      formatTotal: (items) => {
        if (hideInMenu) return null;
        const total = items
          .filter((i) => i.status !== "cancelled")
          .reduce((sum, i) => sum + grossCents(i.unit_price_cents * i.quantity, settings.vatPercent), 0);
        return formatPriceFor(total, settings, shownRate);
      },
      vatPercent: settings.vatPercent,
      pricesIncludeVat: settings.pricesIncludeVat,
      rateNote: shownRate === null ? null : describeRate(settings, bcv),
      rate,
    };
  }, [settings, bcv, audience]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing(): PricingValue {
  return useContext(PricingContext);
}

/** Nota pequeña con la tasa en uso ("BCV dólar: Bs 889,57 · 02/11/2026"); no muestra nada si solo hay dólares. */
export function RateNote({ className = "" }: { className?: string }) {
  const { rateNote, vatPercent, pricesIncludeVat } = usePricing();
  if (!rateNote && vatPercent === 0) return null;
  return (
    <div className={`space-y-1 text-xs text-muted ${className}`}>
      {vatPercent > 0 && (
        <p>{pricesIncludeVat ? `Precios con IVA (${vatPercent}%) incluido.` : `Precios sin IVA: se suma el ${vatPercent}% en la cuenta.`}</p>
      )}
      {rateNote && <p>Precios en bolívares a la {rateNote}</p>}
    </div>
  );
}
