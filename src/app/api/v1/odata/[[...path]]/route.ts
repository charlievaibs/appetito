import { apiError, callApi } from "@/lib/api-server";
import { ENTITIES, metadataXml, ODataError, runQuery } from "@/lib/odata";

const ODATA_HEADERS = { "odata-version": "4.0", "cache-control": "no-store" };

/**
 * Servicio OData v4 de solo lectura: raíz (lista de conjuntos), `$metadata`, `Dishes` e `InventoryItems`.
 * En Excel: Datos → Obtener datos → Otras fuentes → Fuente OData, con la clave como contraseña (Básica).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/odata/[[...path]]">) {
  const { path = [] } = await ctx.params;
  const url = new URL(request.url);
  const root = `${url.origin}/api/v1/odata`;

  // El documento de metadatos no contiene datos del restaurante, pero Excel lo pide antes de autenticar.
  if (path.length === 1 && path[0] === "$metadata") {
    return new Response(metadataXml(), { headers: { ...ODATA_HEADERS, "content-type": "application/xml; charset=utf-8" } });
  }

  if (path.length === 0) {
    return Response.json(
      {
        "@odata.context": `${root}/$metadata`,
        value: ENTITIES.map((e) => ({ name: e.name, kind: "EntitySet", url: e.name })),
      },
      { headers: ODATA_HEADERS },
    );
  }

  const entity = path.length === 1 ? ENTITIES.find((e) => e.name === path[0]) : undefined;
  if (!entity) return apiError(404, "not_found", "Conjunto de datos desconocido: usa Dishes o InventoryItems");

  const result = await callApi(request, entity.rpc);
  if ("response" in result) return result.response;

  try {
    const { value, count } = runQuery(entity, result.data as Record<string, unknown>[], url.searchParams);
    return Response.json(
      {
        "@odata.context": `${root}/$metadata#${entity.name}`,
        ...(url.searchParams.get("$count") === "true" ? { "@odata.count": count } : {}),
        value,
      },
      { headers: ODATA_HEADERS },
    );
  } catch (e) {
    if (e instanceof ODataError) return apiError(400, "invalid_query", e.message);
    throw e;
  }
}
