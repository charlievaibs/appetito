/**
 * Directorio público de restaurantes (los que activaron "aparecer en el directorio").
 * Si se pasan coordenadas, la base de datos calcula la distancia a cada uno.
 */
import type { Json } from "./database.types";
import type { OrderingMode } from "./db";
import type { Coordinates } from "./geo";
import { parsePricingSettings, type PricingSettings } from "./rates";
import { getSupabase } from "./supabase";

export type DirectoryRestaurant = {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string | null;
  address: string | null;
  orderingMode: OrderingMode;
  /** Distancia en metros; null si no se conoce la ubicación de la persona o del restaurante. */
  distanceMeters: number | null;
  /** Cómo muestra sus precios (dólares, bolívares o ambos) y con qué tasa. */
  pricing: PricingSettings;
};

/** Convierte la respuesta de `list_restaurants`, descartando entradas mal formadas. */
export function parseDirectory(json: Json): DirectoryRestaurant[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const { id, name, slug, description, city, address, ordering_mode, distance_m } = entry;
    if (typeof id !== "string" || typeof name !== "string" || typeof slug !== "string") return [];
    return [
      {
        id,
        name,
        slug,
        description: typeof description === "string" ? description : "",
        city: typeof city === "string" ? city : null,
        address: typeof address === "string" ? address : null,
        orderingMode: (typeof ordering_mode === "string" ? ordering_mode : "staff") as OrderingMode,
        distanceMeters: typeof distance_m === "number" ? distance_m : null,
        pricing: parsePricingSettings(entry),
      },
    ];
  });
}

export async function fetchDirectory(coords?: Coordinates): Promise<DirectoryRestaurant[]> {
  const { data, error } = await getSupabase().rpc("list_restaurants", {
    p_lat: coords?.lat,
    p_lng: coords?.lng,
  });
  if (error) throw new Error(error.message);
  return parseDirectory(data);
}
