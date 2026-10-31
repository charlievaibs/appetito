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
import type { PaymentMethod } from "./payments";
import type { ServiceKind } from "./tags";

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
): Promise<ManualJoinResult> {
  await ensureSignedIn();
  const result = await getSupabase().rpc("join_session", {
    p_token: token,
    p_seat_id: options.seatId,
    p_display_name: options.displayName,
  });
  return parseJoinResult(unwrapRpc(result));
}

/** Interpreta la respuesta de un intento de entrar: sentado ya, o esperando al mesero. */
export function parseJoinResult(json: Json): ManualJoinResult {
  const root = asObject(json, "acceso");
  if (root.status === "pending") return { status: "pending", requestId: asString(root.request_id, "solicitud") };
  return { status: "joined", ctx: parseSessionContext(json) };
}

/** Consulta el estado de una mesa a la que ya pertenece el comensal (no abre sesiones). */
export async function fetchSession(sessionId: string): Promise<SessionContext> {
  const result = await getSupabase().rpc("get_session", { p_session_id: sessionId });
  return parseSessionContext(unwrapRpc(result));
}

/** Avisa al personal (llamar al mesero o pedir la cuenta). Repetirlo no duplica el aviso. */
export async function requestService(sessionId: string, kind: ServiceKind): Promise<void> {
  const result = await getSupabase().rpc("request_service", { p_session_id: sessionId, p_kind: kind });
  unwrapRpc(result);
}

/** Marca un aviso como atendido (personal) o lo cancela (quien lo envió). */
export async function resolveRequest(requestId: string): Promise<void> {
  const result = await getSupabase().rpc("resolve_request", { p_request_id: requestId });
  unwrapRpc(result);
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

/** Comensal: pide un cambio sobre un plato que cocina ya empezó; el mesero decide. */
export async function requestItemChange(itemId: string, changes: ItemChanges, message: string): Promise<void> {
  const payload: JsonObject = {};
  if (changes.quantity !== undefined) payload.quantity = changes.quantity;
  if (changes.optionIds !== undefined) payload.option_ids = changes.optionIds;
  if (changes.note !== undefined) payload.note = changes.note;
  const result = await getSupabase().rpc("request_item_change", {
    p_item_id: itemId,
    p_changes: payload,
    p_message: message,
  });
  unwrapRpc(result);
}

/** Personal: acepta (aplica el cambio al plato) o rechaza una solicitud de cambio. */
export async function resolveItemChange(requestId: string, accept: boolean): Promise<void> {
  const result = await getSupabase().rpc("resolve_item_change", { p_request_id: requestId, p_accept: accept });
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

/** Una mesa del restaurante tal como la ve quien elige dónde sentarse. */
export type JoinTable = {
  id: string;
  label: string;
  capacity: number;
  /** libre, ocupada (hay una mesa abierta) o reservada (hace falta código o permiso del mesero). */
  status: "free" | "occupied" | "reserved";
  seats: { id: string; label: string; taken: boolean }[];
};

export type TablesForJoin = {
  restaurantName: string;
  manualJoin: "approval" | "open";
  tables: JoinTable[];
};

/** Convierte la respuesta de `list_tables_for_join`; null si el restaurante no permite elegir mesa a mano. */
export function parseTablesForJoin(json: Json): TablesForJoin | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const restaurant = asObject(json.restaurant, "restaurante");
  const tables = Array.isArray(json.tables) ? json.tables : [];
  return {
    restaurantName: asString(restaurant.name, "nombre"),
    manualJoin: restaurant.manual_join === "open" ? "open" : "approval",
    tables: tables.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
      if (typeof entry.id !== "string" || typeof entry.label !== "string") return [];
      const seats = Array.isArray(entry.seats) ? entry.seats : [];
      const status = entry.status === "occupied" || entry.status === "reserved" ? entry.status : "free";
      return [
        {
          id: entry.id,
          label: entry.label,
          capacity: typeof entry.capacity === "number" ? entry.capacity : seats.length,
          status,
          seats: seats.flatMap((s) =>
            typeof s === "object" && s !== null && !Array.isArray(s) && typeof s.id === "string" && typeof s.label === "string"
              ? [{ id: s.id, label: s.label, taken: s.taken === true }]
              : [],
          ),
        },
      ];
    }),
  };
}

/** Mesas del restaurante para elegir a mano (no requiere sesión). */
export async function listTablesForJoin(slug: string): Promise<TablesForJoin | null> {
  const result = await getSupabase().rpc("list_tables_for_join", { p_slug: slug });
  return parseTablesForJoin(unwrapRpc(result));
}

export type ManualJoinResult =
  | { status: "joined"; ctx: SessionContext }
  | { status: "pending"; requestId: string };

/**
 * Elige mesa (y asiento) a mano. Con un código válido, o si la mesa está libre y el restaurante
 * lo permite, entra directo; en otro caso queda pendiente de que el mesero dé acceso.
 */
export async function joinTableManual(
  tableId: string,
  options: { seatId?: string; displayName?: string; code?: string } = {},
): Promise<ManualJoinResult> {
  await ensureSignedIn();
  const result = await getSupabase().rpc("join_table_manual", {
    p_table_id: tableId,
    p_seat_id: options.seatId,
    p_display_name: options.displayName,
    p_code: options.code,
  });
  return parseJoinResult(unwrapRpc(result));
}

/** Cancela una solicitud de acceso pendiente. */
export async function cancelJoinRequest(requestId: string): Promise<void> {
  unwrapRpc(await getSupabase().rpc("cancel_join_request", { p_request_id: requestId }));
}

/** Personal: da acceso a quien eligió una mesa a mano, o lo rechaza. */
export async function resolveJoinRequest(requestId: string, accept: boolean): Promise<void> {
  unwrapRpc(await getSupabase().rpc("resolve_join_request", { p_request_id: requestId, p_accept: accept }));
}

/** Invitación rotativa para unirse a una mesa: el token caduca en pocos minutos. */
export type SessionInvite = { token: string; expiresAt: number };

/** Crea una invitación nueva (quien está sentado en la mesa o el personal que toma pedidos). */
export async function createSessionInvite(sessionId: string): Promise<SessionInvite> {
  const json = asObject(unwrapRpc(await getSupabase().rpc("create_session_invite", { p_session_id: sessionId })), "invitación");
  return { token: asString(json.token, "token"), expiresAt: Date.parse(asString(json.expires_at, "caducidad")) };
}

/** Entra a la mesa con el token de una invitación vigente. */
export async function joinWithInvite(
  token: string,
  options: { seatId?: string; displayName?: string } = {},
): Promise<SessionContext> {
  await ensureSignedIn();
  const result = await getSupabase().rpc("join_with_invite", {
    p_token: token,
    p_seat_id: options.seatId,
    p_display_name: options.displayName,
  });
  return parseSessionContext(unwrapRpc(result));
}

/** Personal: confirma que hay gente en una mesa que se abrió con un escaneo. */
export async function confirmSession(sessionId: string): Promise<void> {
  unwrapRpc(await getSupabase().rpc("confirm_session", { p_session_id: sessionId }));
}

/** Comensal: avisa que va a pagar estos platos; el personal lo confirma. Devuelve el id del pago. */
export async function requestPayment(
  sessionId: string,
  itemIds: string[],
  method: PaymentMethod,
  options: { reference?: string; payerName?: string } = {},
): Promise<string> {
  const result = await getSupabase().rpc("request_payment", {
    p_session_id: sessionId,
    p_item_ids: itemIds,
    p_method: method,
    p_reference: options.reference,
    p_payer_name: options.payerName,
  });
  return unwrapRpc(result);
}

/** Retira un pago propio mientras siga pendiente. */
export async function cancelPayment(paymentId: string): Promise<void> {
  unwrapRpc(await getSupabase().rpc("cancel_payment", { p_payment_id: paymentId }));
}

/** Personal: registra un cobro ya hecho. Sin lista de platos cobra todo lo pendiente. */
export async function staffRecordPayment(
  sessionId: string,
  itemIds: string[] | null,
  method: PaymentMethod,
  options: { reference?: string; payerName?: string; currency?: "USD" | "VES"; rate?: number } = {},
): Promise<string> {
  const result = await getSupabase().rpc("staff_record_payment", {
    p_session_id: sessionId,
    // La función acepta null para «todo lo pendiente»; el tipo generado no lo refleja.
    p_item_ids: itemIds as string[],
    p_method: method,
    p_reference: options.reference,
    p_payer_name: options.payerName,
    p_currency: options.currency,
    p_rate: options.rate,
  });
  return unwrapRpc(result);
}

/** Personal: confirma (fijando cómo se pagó) o rechaza un pago pedido por un comensal. */
export async function confirmPayment(
  paymentId: string,
  accept: boolean,
  options: { method?: PaymentMethod; reference?: string; currency?: "USD" | "VES"; rate?: number } = {},
): Promise<void> {
  unwrapRpc(
    await getSupabase().rpc("confirm_payment", {
      p_payment_id: paymentId,
      p_accept: accept,
      p_method: options.method,
      p_reference: options.reference,
      p_currency: options.currency,
      p_rate: options.rate,
    }),
  );
}
