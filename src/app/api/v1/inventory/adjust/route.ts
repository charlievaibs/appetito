import { apiError, callApi, jsonResponse, readJson } from "@/lib/api-server";

/**
 * Suma o resta stock de un artículo: { "sku": "pan", "delta": -3, "reason": "consumo", "note": "…" }.
 * `reason`: compra, merma, ajuste o consumo. Devuelve el stock resultante.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if ("response" in body) return body.response;
  const { sku, delta, reason, note } = (body.value ?? {}) as Record<string, unknown>;

  if (typeof sku !== "string" || typeof delta !== "number" || !Number.isFinite(delta) || typeof reason !== "string") {
    return apiError(400, "invalid_body", "Se necesitan sku (texto), delta (número) y reason (texto)");
  }
  if (note !== undefined && typeof note !== "string") return apiError(400, "invalid_body", "note debe ser texto");

  const result = await callApi(request, "api_inventory_adjust", {
    p_sku: sku,
    p_delta: delta,
    p_reason: reason,
    p_note: note,
  });
  return "response" in result ? result.response : jsonResponse({ sku, stock: result.data });
}
