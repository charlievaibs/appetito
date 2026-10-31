"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchDirectory } from "@/lib/directory";
import { loadSavedSession } from "@/lib/diner-session";
import { formatDistance, getCurrentCoordinates, NEARBY_METERS, type Coordinates } from "@/lib/geo";
import { useAsyncLoad } from "@/lib/use-async-load";

/**
 * Inicio de la app para comensales. Prioriza ahorrar clics:
 * 1. Si ya hay una mesa recordada en este dispositivo, va directo a ella.
 * 2. Si no, explica cómo entrar (NFC o QR de la mesa) y muestra el directorio,
 *    con la opción de ordenarlo por cercanía.
 */
export function DinerHome() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // La mesa recordada se lee del navegador, así que se consulta tras montar.
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = loadSavedSession();
      setHasSession(saved !== null);
      setChecked(true);
      if (saved) router.replace("/mesa");
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  if (!checked || hasSession) {
    return <div className="mt-6 h-40 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }

  return (
    <div>
      <section className="rounded-3xl bg-tomato px-6 py-8 text-white">
        <h1 className="text-2xl font-bold tracking-tight">¿Ya estás en tu mesa?</h1>
        <p className="mt-2 text-white/90">
          Acerca tu móvil a la etiqueta <strong>NFC</strong> de tu mesa o escanea su <strong>QR</strong>.
          Entras al instante, sin crear cuenta, y puedes pedir y ajustar tu plato desde aquí.
        </p>
      </section>

      <Directory />

      <p className="mt-10 text-center text-sm text-muted">
        ¿Eres del restaurante?{" "}
        <Link href="/panel" className="font-semibold text-tomato underline">
          Entra al panel
        </Link>
      </p>
    </div>
  );
}

/** Lista de restaurantes con botón "Cerca de mí" (la ubicación solo se pide al pulsarlo). */
function Directory() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const loader = useCallback(() => fetchDirectory(coords ?? undefined), [coords]);
  const { data: restaurants, error } = useAsyncLoad(loader);

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      setCoords(await getCurrentCoordinates());
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "No pudimos obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="directory-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="directory-title" className="text-xl font-bold">
          Restaurantes
        </h2>
        <button
          type="button"
          onClick={() => void locate()}
          disabled={locating}
          className="inline-flex h-10 items-center rounded-full border border-line bg-card px-4 text-sm font-medium hover:bg-line disabled:opacity-50"
        >
          {coords ? "Actualizar ubicación" : locating ? "Buscando…" : "📍 Cerca de mí"}
        </button>
      </div>

      {geoError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {geoError}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {!restaurants && !error && (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-card" aria-hidden="true" />
      )}
      {restaurants?.length === 0 && (
        <p className="py-8 text-center text-muted">Todavía no hay restaurantes en el directorio.</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {restaurants?.map((r) => {
          const here = r.distanceMeters !== null && r.distanceMeters <= NEARBY_METERS;
          return (
            <li key={r.id}>
              <Link
                href={`/r/${r.slug}`}
                className="block rounded-2xl border border-line bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.distanceMeters !== null && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        here ? "bg-green-500/20 text-green-600" : "bg-line text-muted"
                      }`}
                    >
                      {here ? "Estás aquí · " : ""}
                      {formatDistance(r.distanceMeters)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{[r.city, r.address].filter(Boolean).join(" · ")}</p>
                {r.description && <p className="mt-1 text-sm">{r.description}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
