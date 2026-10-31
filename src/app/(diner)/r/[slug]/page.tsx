import type { Metadata } from "next";
import { Suspense } from "react";
import { RestaurantPage } from "@/components/diner/restaurant-page";

export const metadata: Metadata = {
  title: "Restaurante · Appetito",
};

export default function RestaurantRoute({ params }: PageProps<"/r/[slug]">) {
  return (
    <Suspense fallback={<div className="mt-6 h-48 animate-pulse rounded-2xl bg-card" aria-hidden="true" />}>
      <RestaurantFromParams params={params} />
    </Suspense>
  );
}

/** Espera el parámetro de la ruta (el slug del restaurante) dentro de Suspense. */
async function RestaurantFromParams({ params }: Pick<PageProps<"/r/[slug]">, "params">) {
  const { slug } = await params;
  return <RestaurantPage slug={slug} />;
}
