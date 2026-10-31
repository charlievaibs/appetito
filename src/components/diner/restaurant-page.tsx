"use client";

import Link from "next/link";
import { useCallback } from "react";
import { MenuList } from "@/components/menu-list";
import { TablePicker } from "./table-picker";
import type { DishWithOptions } from "@/lib/db";
import { fetchDirectory } from "@/lib/directory";
import { getSupabase } from "@/lib/supabase";
import { unwrap, useAsyncLoad } from "@/lib/use-async-load";

/**
 * Página pública de un restaurante del directorio: sus datos y su menú en modo
 * lectura. Para pedir hay que estar en la mesa (NFC o QR); así un pedido siempre
 * viene de alguien que de verdad está en el local.
 */
export function RestaurantPage({ slug }: { slug: string }) {
  const loader = useCallback(async () => {
    const restaurant = (await fetchDirectory()).find((r) => r.slug === slug) ?? null;
    if (!restaurant) return { restaurant: null, dishes: [] as DishWithOptions[] };
    const dishes = unwrap(
      await getSupabase()
        .from("dishes")
        .select("*, dish_option_groups(*, dish_options(*))")
        .eq("restaurant_id", restaurant.id)
        .order("position")
        .order("name"),
    ) as DishWithOptions[];
    return { restaurant, dishes };
  }, [slug]);

  const { data, error } = useAsyncLoad(loader);

  if (error) {
    return (
      <p role="alert" className="mt-10 text-center text-red-600">
        {error}
      </p>
    );
  }
  if (!data) {
    return <div className="mt-6 h-48 animate-pulse rounded-2xl bg-card" aria-hidden="true" />;
  }
  if (!data.restaurant) {
    return (
      <div className="mt-16 text-center">
        <h1 className="text-xl font-bold">No encontramos ese restaurante</h1>
        <Link href="/app" className="mt-4 inline-block font-semibold text-tomato underline">
          Ver todos los restaurantes
        </Link>
      </div>
    );
  }

  const { restaurant, dishes } = data;
  return (
    <div>
      <Link href="/app" className="text-sm font-medium text-muted hover:text-foreground">
        ← Todos los restaurantes
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{restaurant.name}</h1>
      <p className="text-muted">{[restaurant.city, restaurant.address].filter(Boolean).join(" · ")}</p>
      {restaurant.description && <p className="mt-2">{restaurant.description}</p>}

      <p className="mt-4 rounded-xl bg-tomato/10 px-4 py-3 text-sm">
        {restaurant.orderingMode === "staff"
          ? "Aquí te atiende un mesero. Puedes ver el menú antes de sentarte."
          : "Para pedir, acerca tu móvil a la etiqueta NFC de tu mesa, escanea su QR o elige tu mesa abajo."}
      </p>

      <TablePicker slug={slug} />

      <div className="mt-6">
        <MenuList dishes={dishes} />
      </div>
    </div>
  );
}
