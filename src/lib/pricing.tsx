"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  describeRate,
  formatPriceFor,
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
};

const PricingContext = createContext<PricingValue>({
  format: (cents) => formatPriceFor(cents, USD_ONLY, null),
  rateNote: null,
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
export function PricingProvider({ settings, children }: { settings: PricingSettings; children: ReactNode }) {
  const needsBcv = settings.display !== "usd" && settings.source !== "manual";
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
    const rate = settings.display === "usd" ? null : pickRate(settings, bcv);
    return {
      format: (cents) => formatPriceFor(cents, settings, rate),
      rateNote: rate === null ? null : describeRate(settings, bcv),
    };
  }, [settings, bcv]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing(): PricingValue {
  return useContext(PricingContext);
}

/** Nota pequeña con la tasa en uso ("BCV dólar: Bs 889,57 · 02/11/2026"); no muestra nada si solo hay dólares. */
export function RateNote({ className = "" }: { className?: string }) {
  const { rateNote } = usePricing();
  if (!rateNote) return null;
  return <p className={`text-xs text-muted ${className}`}>Precios en bolívares a la {rateNote}</p>;
}
