/**
 * Direcciones de las etiquetas NFC y los QR. Ambos llevan la misma URL: `/m/<código>`
 * identifica la mesa o el puesto, y un parámetro opcional `a` añade una acción
 * («llamar al mesero», «pedir la cuenta») para etiquetas dedicadas a eso.
 */

/** Avisos que un comensal puede enviar al personal. */
export type ServiceKind = "waiter" | "bill";

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  waiter: "Llamar al mesero",
  bill: "Pedir la cuenta",
};

/** Valor del parámetro `a` de la URL para cada acción. */
const ACTION_PARAM: Record<ServiceKind, string> = { waiter: "mesero", bill: "cuenta" };

/** Construye la dirección que se graba en una etiqueta o se imprime en un QR. */
export function tagUrl(origin: string, token: string, action?: ServiceKind): string {
  const base = `${origin}/m/${encodeURIComponent(token)}`;
  return action ? `${base}?a=${ACTION_PARAM[action]}` : base;
}

/**
 * Extrae el código de lo que lee el escáner: la dirección completa de una etiqueta
 * (`https://…/m/<código>?a=mesero`) o, por si acaso, el código suelto. Devuelve null
 * si no parece una etiqueta de Appetito.
 */
export function parseTagLink(text: string): { token: string; action: ServiceKind | null } | null {
  const value = text.trim();
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    // No es una dirección: puede ser un código suelto.
  }
  if (url) {
    const match = /^\/m\/([A-Za-z0-9]{8,64})\/?$/.exec(url.pathname);
    return match ? { token: match[1], action: parseTagAction(url.search) } : null;
  }
  return /^[A-Za-z0-9]{32}$/.test(value) ? { token: value, action: null } : null;
}

/** Lee la acción de una cadena de consulta (`?a=mesero`); null si no hay o no se reconoce. */
export function parseTagAction(search: string): ServiceKind | null {
  const value = new URLSearchParams(search).get("a");
  const found = (Object.keys(ACTION_PARAM) as ServiceKind[]).find((k) => ACTION_PARAM[k] === value);
  return found ?? null;
}

/** Dirección que abre quien escanea la invitación rotativa de una mesa. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin}/i/${encodeURIComponent(token)}`;
}
