/**
 * Recuerda en el dispositivo la mesa en la que está sentado el comensal, para que
 * al abrir la app vuelva directo a pedir, sin escanear de nuevo.
 *
 * Solo se guarda lo mínimo para reencontrar la sesión (su id y datos para mostrar).
 * La configuración del restaurante y el estado real de la mesa se consultan
 * siempre a la base de datos con `get_session`.
 */

export type SavedSession = {
  sessionId: string;
  restaurantName: string;
  tableLabel: string;
  savedAt: number;
};

const STORAGE_KEY = "appetito:diner-session:v1";

/** Pasado este tiempo se olvida la mesa aunque nadie la haya cerrado. */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Interpreta lo guardado; devuelve null si no es válido o ya caducó. */
export function parseSavedSession(raw: string | null, now: number): SavedSession | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { sessionId, restaurantName, tableLabel, savedAt } = data as Record<string, unknown>;
  if (
    typeof sessionId !== "string" ||
    typeof restaurantName !== "string" ||
    typeof tableLabel !== "string" ||
    typeof savedAt !== "number"
  ) {
    return null;
  }
  if (now - savedAt > SESSION_MAX_AGE_MS) return null;
  return { sessionId, restaurantName, tableLabel, savedAt };
}

/** Lee la mesa guardada (solo en el navegador). */
export function loadSavedSession(): SavedSession | null {
  try {
    return parseSavedSession(localStorage.getItem(STORAGE_KEY), Date.now());
  } catch {
    return null; // localStorage bloqueado
  }
}

export function saveSession(session: Omit<SavedSession, "savedAt">): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {
    // Sin almacenamiento la app funciona igual, solo que no recuerda la mesa.
  }
}

export function clearSavedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}
