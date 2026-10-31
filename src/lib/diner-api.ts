/**
 * Operaciones del comensal contra Supabase. Cada función lanza un `Error` con un
 * mensaje ya traducido al español (ver errors.ts), listo para mostrar.
 *
 * Los comensales entran como invitados (inicio de sesión anónimo): no necesitan
 * crear cuenta. Todas las escrituras pasan por funciones de la base de datos que
 * validan permisos y calculan los precios; el cliente nunca decide un precio.
 */
import type { Json } from "./database.types";
import type { ChangePolicy, Identification, OrderingMode } from "./db";
import { describeError } from "./errors";
import { getSupabase } from "./supabase";

/** Estado de una mesa abierta, con la configuración del restaurante. */
export type SessionContext = {
  sessionId: string;
  status: "open" | "closed";
  restaurant: {
    id: string;
    name: string;
    slug: string;
    orderingMode: OrderingMode;
    identification: Identification;
    changePolicy: ChangePolicy;
  };
  table: { id: string; label: string; reservedBy: string | null };
  /** Datos del comensal en esta mesa (null si quien consulta es personal del restaurante). */
  participant: { seatId: string | null; seatLabel: string | null; displayName: string | null } | null;
  seats: { id: string; label: string }[];
};

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json | undefined, what: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Respuesta inesperada del servidor (${what}).`);
  }
  return value;
}

function asString(value: Json | undefined, what: string): string {
  if (typeof value !== "string") throw new Error(`Respuesta inesperada del servidor (${what}).`);
  return value;
}

function asNullableString(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/** Convierte la respuesta JSON de `join_session` / `get_session` en un objeto tipado. */
export function parseSessionContext(json: Json): SessionContext {
  const root = asObject(json, "sesión");
  const restaurant = asObject(root.restaurant, "restaurante");
  const table = asObject(root.table, "mesa");
  const participant = root.participant ? asObject(root.participant, "comensal") : null;
  const seats = Array.isArray(root.seats) ? root.seats : [];

  return {
    sessionId: asString(root.session_id, "id"),
    status: root.status === "closed" ? "closed" : "open",
    restaurant: {
      id: asString(restaurant.id, "restaurante"),
      name: asString(restaurant.name, "nombre"),
      slug: asString(restaurant.slug, "slug"),
      orderingMode: asString(restaurant.ordering_mode, "modo") as OrderingMode,
      identification: asString(restaurant.identification, "identificación") as Identification,
      changePolicy: asString(restaurant.change_policy, "política") as ChangePolicy,
    },
    table: {
      id: asString(table.id, "mesa"),
      label: asString(table.label, "mesa"),
      reservedBy: asNullableString(table.reserved_by),
    },
    participant: participant && {
      seatId: asNullableString(participant.seat_id),
      seatLabel: asNullableString(participant.seat_label),
      displayName: asNullableString(participant.display_name),
    },
    seats: seats.flatMap((s) => {
      const seat = typeof s === "object" && s !== null && !Array.isArray(s) ? s : null;
      return seat && typeof seat.id === "string" && typeof seat.label === "string"
        ? [{ id: seat.id, label: seat.label }]
        : [];
    }),
  };
}

/** Lanza un error en español si la respuesta de Supabase trae error. */
function unwrapRpc<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(describeError(result.error.message));
  return result.data as T;
}

/** Garantiza que haya una sesión (de invitado si hace falta) y devuelve el id de usuario. */
export async function ensureSignedIn(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw new Error(describeError(error?.message ?? "auth_required"));
  return signedIn.user.id;
}

/** Entra a una mesa con el código de un QR o una etiqueta NFC. */
export async function joinSession(
  token: string,
  options: { seatId?: string; displayName?: string } = {},
): Promise<SessionContext> {
  await ensureSignedIn();
  const result = await getSupabase().rpc("join_session", {
    p_token: token,
    p_seat_id: options.seatId,
    p_display_name: options.displayName,
  });
  return parseSessionContext(unwrapRpc(result));
}

/** Consulta el estado de una mesa a la que ya pertenece el comensal (no abre sesiones). */
export async function fetchSession(sessionId: string): Promise<SessionContext> {
  const result = await getSupabase().rpc("get_session", { p_session_id: sessionId });
  return parseSessionContext(unwrapRpc(result));
}

/** Un plato que se quiere pedir. */
export type ItemInput = {
  dishId: string;
  quantity: number;
  optionIds: string[];
  note: string;
};

/** Agrega platos a la mesa. Sirve para comensales y para el personal. */
export async function addItems(
  sessionId: string,
  items: ItemInput[],
  options: { seatId?: string; forName?: string } = {},
): Promise<void> {
  const result = await getSupabase().rpc("add_items", {
    p_session_id: sessionId,
    p_items: items.map((i) => ({
      dish_id: i.dishId,
      quantity: i.quantity,
      option_ids: i.optionIds,
      note: i.note,
    })),
    p_seat_id: options.seatId,
    p_for_name: options.forName,
  });
  unwrapRpc(result);
}

/** Cambios posibles sobre un plato ya pedido. `quantity: 0` lo cancela. */
export type ItemChanges = { quantity?: number; optionIds?: string[]; note?: string };

export async function updateItem(itemId: string, changes: ItemChanges): Promise<void> {
  const payload: JsonObject = {};
  if (changes.quantity !== undefined) payload.quantity = changes.quantity;
  if (changes.optionIds !== undefined) payload.option_ids = changes.optionIds;
  if (changes.note !== undefined) payload.note = changes.note;
  const result = await getSupabase().rpc("update_item", { p_item_id: itemId, p_changes: payload });
  unwrapRpc(result);
}

/** Cambia el puesto o el nombre del comensal dentro de la mesa. */
export async function updateParticipant(
  sessionId: string,
  changes: { seatId?: string; displayName?: string },
): Promise<void> {
  const result = await getSupabase().rpc("update_participant", {
    p_session_id: sessionId,
    p_seat_id: changes.seatId,
    p_display_name: changes.displayName,
  });
  unwrapRpc(result);
}
