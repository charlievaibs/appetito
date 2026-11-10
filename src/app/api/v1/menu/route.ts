import { apiError, callApi, jsonResponse, readJson, rowsFrom } from "@/lib/api-server";

/** Lista el menú del restaurante dueño de la clave. Precios sin IVA, en la moneda base. */
export async function GET(request: Request) {
  const result = await callApi(request, "api_menu_list");
  return "response" in result ? result.response : jsonResponse({ data: result.data });
}

/** Crea o actualiza platos (clave: `code` o, si falta, `name`). Solo cambia los campos enviados. */
async function upsert(request: Request) {
  const body = await readJson(request);
  if ("response" in body) return body.response;
  const rows = rowsFrom(body.value);
  if (!rows) return apiError(400, "invalid_body", 'Envía una lista de filas o { "rows": [...] }');

  const result = await callApi(request, "api_menu_upsert", { p_rows: rows });
  return "response" in result ? result.response : jsonResponse(result.data);
}

export { upsert as POST, upsert as PUT };
