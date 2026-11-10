import { apiError, callApi, jsonResponse, readJson, rowsFrom } from "@/lib/api-server";

/** Lista el inventario del restaurante dueño de la clave. Costos sin IVA, en la moneda base. */
export async function GET(request: Request) {
  const result = await callApi(request, "api_inventory_list");
  return "response" in result ? result.response : jsonResponse({ data: result.data });
}

/** Crea o actualiza artículos (clave: `sku` o, si falta, `name`). Un cambio de `stock` queda anotado. */
async function upsert(request: Request) {
  const body = await readJson(request);
  if ("response" in body) return body.response;
  const rows = rowsFrom(body.value);
  if (!rows) return apiError(400, "invalid_body", 'Envía una lista de filas o { "rows": [...] }');

  const result = await callApi(request, "api_inventory_upsert", { p_rows: rows });
  return "response" in result ? result.response : jsonResponse(result.data);
}

export { upsert as POST, upsert as PUT };
