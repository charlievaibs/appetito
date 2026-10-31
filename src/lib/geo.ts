/** Utilidades de ubicación del navegador. Siempre se piden tras un gesto de la persona. */

export type Coordinates = { lat: number; lng: number };

/**
 * Pide la ubicación aproximada al navegador. Es solo una sugerencia para proponer
 * restaurantes cercanos: nunca se usa para dar por hecho que alguien está sentado.
 */
export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Tu navegador no permite usar la ubicación."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "No diste permiso de ubicación. Puedes elegir el restaurante a mano."
              : "No pudimos obtener tu ubicación.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Texto corto para una distancia en metros ("120 m", "1.4 km"). */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Distancia (en metros) a partir de la cual se considera que alguien está "en" el restaurante. */
export const NEARBY_METERS = 150;
