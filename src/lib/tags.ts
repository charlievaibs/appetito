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

/** Lee la acción de una cadena de consulta (`?a=mesero`); null si no hay o no se reconoce. */
export function parseTagAction(search: string): ServiceKind | null {
  const value = new URLSearchParams(search).get("a");
  const found = (Object.keys(ACTION_PARAM) as ServiceKind[]).find((k) => ACTION_PARAM[k] === value);
  return found ?? null;
}
