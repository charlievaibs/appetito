"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchDirectory, type DirectoryRestaurant } from "@/lib/directory";
import { loadSavedSession } from "@/lib/diner-session";
import { formatDistance, getCurrentCoordinates, NEARBY_METERS, type Coordinates } from "@/lib/geo";
import { useAsyncLoad } from "@/lib/use-async-load";
import { AccountBar } from "./account-bar";
import { InstallApp } from "./install-app";
import { QrScanner } from "./qr-scanner";

/**
 * Inicio de la app para comensales. Prioriza ahorrar clics:
 * 1. Si ya hay una mesa recordada en este dispositivo, va directo a ella.
 * 2. Si no: cuenta opcional (entrar / crear cuenta / Google), escanear la etiqueta de
 *    la mesa como acción principal, restaurantes cercanos en una lista desplegable y,
 *    al final, el directorio completo.
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
    <div className="flex flex-col gap-4">
      <AccountBar />
      <ScanCard />
      <Browse />
      <InstallApp />
      <p className="mt-6 text-center text-sm text-muted">
        ¿Eres del restaurante?{" "}
        <Link href="/panel" className="font-semibold text-tomato underline">
          Entra al panel
        </Link>
      </p>
    </div>
  );
}

/** Acción principal: escanear el QR (o acercar el móvil a la etiqueta NFC) de la mesa. */
function ScanCard() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  // Estable a propósito: el escáner reinicia la cámara si esta función cambia.
  const onFound = useCallback(
    (tag: { token: string; action: "waiter" | "bill" | null }) => {
      setScanning(false);
      const query = tag.action ? `?a=${tag.action === "waiter" ? "mesero" : "cuenta"}` : "";
      router.push(`/m/${tag.token}${query}`);
    },
    [router],
  );

  return (
    <section className="rounded-3xl bg-tomato px-6 py-7 text-white">
      <h1 className="text-2xl font-bold tracking-tight">¿Ya estás en tu mesa?</h1>
      <p className="mt-2 text-white/90">
        Escanea el <strong>QR</strong> o acerca tu móvil a la etiqueta <strong>NFC</strong>. Entras al
        instante, sin crear cuenta, y puedes pedir y ajustar tu plato desde aquí.
      </p>
      <button
        type="button"
        onClick={() => setScanning(true)}
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-white font-semibold text-tomato-dark transition-transform active:scale-[0.98]"
      >
        📷 Escanear QR de la mesa
      </button>
      {scanning && <QrScanner onFound={onFound} onClose={() => setScanning(false)} />}
    </section>
  );
}

/**
 * Cómo encontrar el restaurante sin etiqueta: lista desplegable con los más cercanos
 * (tras dar permiso de ubicación) y, debajo, el directorio completo.
 */
function Browse() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const loader = useCallback(() => fetchDirectory(coords ?? undefined), [coords]);
  const { data: restaurants, error } = useAsyncLoad(loader);

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError(null);
    try {
      setCoords(await getCurrentCoordinates());
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "No pudimos obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  }, []);

  // Si la persona ya dio permiso antes, se usa sin volver a preguntar; si no, espera a que lo pida.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((status) => {
          if (active && status.state === "granted") void locate();
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locate]);

  return (
    <>
      <NearbySelect
        restaurants={restaurants}
        located={coords !== null}
        locating={locating}
        onLocate={() => void locate()}
        geoError={geoError}
      />
      <Directory restaurants={restaurants} error={error} />
    </>
  );
}

/** Lista desplegable de restaurantes cercanos; al elegir uno se abre su ficha. */
function NearbySelect({
  restaurants,
  located,
  locating,
  onLocate,
  geoError,
}: {
  restaurants: DirectoryRestaurant[] | null;
  located: boolean;
  locating: boolean;
  onLocate: () => void;
  geoError: string | null;
}) {
  const router = useRouter();
  const nearby = (restaurants ?? []).filter((r) => r.distanceMeters !== null);

  return (
    <section aria-labelledby="nearby-title" className="rounded-2xl border border-line bg-card p-4">
      <h2 id="nearby-title" className="font-semibold">
        O elige un restaurante cercano
      </h2>
      {located ? (
        <>
          <label className="sr-only" htmlFor="nearby-select">
            Restaurantes cercanos
          </label>
          <select
            id="nearby-select"
            defaultValue=""
            onChange={(e) => e.target.value && router.push(`/r/${e.target.value}`)}
            className="mt-2 h-11 w-full rounded-xl border border-line bg-background px-3"
          >
            <option value="">
              {nearby.length > 0 ? "Elige un restaurante…" : "No hay restaurantes con ubicación cerca"}
            </option>
            {nearby.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name} · {formatDistance(r.distanceMeters ?? 0)}
                {r.distanceMeters !== null && r.distanceMeters <= NEARBY_METERS ? " · estás aquí" : ""}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Con tu ubicación te mostramos los más cercanos. Solo se usa para ordenarlos; no se guarda.
          </p>
          <button
            type="button"
            onClick={onLocate}
            disabled={locating}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-background text-sm font-semibold hover:bg-line disabled:opacity-50"
          >
            {locating ? "Buscando…" : "📍 Permitir ubicación"}
          </button>
        </>
      )}
      {geoError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {geoError}
        </p>
      )}
    </section>
  );
}

/** Directorio completo (ordenado por cercanía si se conoce la ubicación). */
function Directory({
  restaurants,
  error,
}: {
  restaurants: DirectoryRestaurant[] | null;
  error: string | null;
}) {
  return (
    <section aria-labelledby="directory-title">
      <h2 id="directory-title" className="text-xl font-bold">
        Todos los restaurantes
      </h2>
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
