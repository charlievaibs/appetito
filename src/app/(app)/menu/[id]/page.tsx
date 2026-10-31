import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { dishes, getDish } from "@/data/menu";
import { formatPrice } from "@/lib/money";

export function generateStaticParams() {
  return dishes.map((d) => ({ id: d.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/menu/[id]">): Promise<Metadata> {
  const { id } = await params;
  const dish = getDish(id);
  return {
    title: dish ? `${dish.name} · Appetito` : "Plato no encontrado · Appetito",
    description: dish?.description,
  };
}

export default async function DishPage({ params }: PageProps<"/menu/[id]">) {
  const { id } = await params;
  const dish = getDish(id);
  if (!dish) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/menu" className="text-sm font-medium text-muted hover:text-foreground">
        ← Volver al menú
      </Link>

      <div className="mt-4 rounded-3xl border border-line bg-card p-6 sm:p-8">
        <div
          className="flex h-48 items-center justify-center rounded-2xl bg-tomato/10 text-8xl"
          aria-hidden="true"
        >
          {dish.emoji}
        </div>
        <p className="mt-6 text-sm font-medium text-muted">{dish.category}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{dish.name}</h1>
        <p className="mt-3 text-muted">{dish.description}</p>
        <p className="mt-4 text-2xl font-bold text-tomato">
          {formatPrice(dish.priceCents)}
        </p>
        <AddToCart dish={dish} />
      </div>
    </div>
  );
}
