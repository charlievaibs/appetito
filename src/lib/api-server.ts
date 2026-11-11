/**
 * Apoyo para la API pública (`/api/v1/*`): leer la clave de la petición, hablar con la base y
 * traducir sus errores a respuestas HTTP. La clave es la única credencial; la base la comprueba
 * (guarda solo su huella SHA-256) y decide a qué restaurante pertenece.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const NO_STORE = { "cache-control": "no-store" };

/** Clave desde `Authorization: Bearer <clave>` o `Basic` (usuario cualquiera, contraseña = clave: lo que usa Excel). */
export function apiKeyFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(header);
  if (bearer) return bearer[1];
  const basic = /^Basic\s+(\S+)$/i.exec(header);
  if (basic) {
    try {
      const decoded = atob(basic[1]);
      const colon = decoded.indexOf(":");
      return colon >= 0 ? decoded.slice(colon + 1) : decoded;
    } catch {
      return null;
    }
  }
  return null;
}

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Falta la configuración de Supabase");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function apiError(status: number, code: string, message: string, extra?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...extra } });
}

const UNAUTHORIZED = { "www-authenticate": 'Basic realm="Appetito API", charset="UTF-8"' };

/** Traduce el mensaje que lanza la base a una respuesta HTTP clara (sin filtrar detalles internos). */
function mapDatabaseError(message: string): Response {
  if (message.includes("invalid_api_key")) {
    return apiError(401, "invalid_api_key", "Clave de API no válida o revocada", UNAUTHORIZED);
  }
  if (message.includes("api_key_read_only")) {
    return apiError(403, "read_only_key", "Esta clave solo puede leer; crea una con permiso de escritura");
  }
  if (message.includes("rate_limited")) {
    return apiError(429, "rate_limited", "Demasiadas peticiones: el límite es de 120 por minuto por clave", {
      "retry-after": "60",
    });
  }
  if (message.includes("item_not_found")) return apiError(404, "not_found", "No existe un artículo con ese sku");
  if (message.includes("rows_must_be_array")) return apiError(400, "invalid_body", "Se esperaba una lista de filas");
  if (message.includes("too_many_rows")) return apiError(400, "too_many_rows", "Máximo 2000 filas por llamada");
  if (message.includes("invalid_reason")) {
    return apiError(400, "invalid_reason", "reason debe ser compra, merma, ajuste o consumo");
  }
  if (message.includes("La cantidad")) return apiError(400, "invalid_amount", message);
  return apiError(502, "upstream_error", "No se pudo completar la operación");
}

type RpcName =
  | "api_menu_list"
  | "api_menu_upsert"
  | "api_inventory_list"
  | "api_inventory_upsert"
  | "api_inventory_adjust";

/** Llama a una función de la API en la base con la clave de la petición. Devuelve datos o una respuesta de error. */
export async function callApi(
  request: Request,
  fn: RpcName,
  args: Record<string, Json | undefined> = {},
): Promise<{ data: Json } | { response: Response }> {
  const key = apiKeyFrom(request);
  if (!key) {
    return {
      response: apiError(401, "missing_api_key", "Envía la clave en la cabecera Authorization: Bearer <clave>", UNAUTHORIZED),
    };
  }
  try {
    // El tipado de supabase-js no admite nombres de función dinámicos; las firmas están en database.types.
    const { data, error } = await (database().rpc as (f: string, a: object) => PromiseLike<{ data: Json; error: { message: string } | null }>)(fn, {
      p_key: key,
      ...args,
    });
    if (error) return { response: mapDatabaseError(error.message) };
    return { data };
  } catch {
    return { response: apiError(502, "upstream_error", "No se pudo completar la operación") };
  }
}

/** Lee el cuerpo JSON con tope de tamaño. Devuelve el valor o una respuesta de error. */
export async function readJson(request: Request): Promise<{ value: unknown } | { response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { response: apiError(413, "too_large", "El cuerpo supera los 2 MB") };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { response: apiError(413, "too_large", "El cuerpo supera los 2 MB") };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { response: apiError(400, "invalid_json", "El cuerpo no es JSON válido") };
  }
}

/** Acepta una lista de filas o un objeto `{ "rows": [...] }`. */
export function rowsFrom(value: unknown): Json | null {
  if (Array.isArray(value)) return value as Json;
  if (value && typeof value === "object" && Array.isArray((value as { rows?: unknown }).rows)) {
    return (value as { rows: Json }).rows;
  }
  return null;
}
