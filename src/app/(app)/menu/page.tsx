import type { Metadata } from "next";
import { MenuBrowser } from "@/components/menu-browser";
import { categories, dishes } from "@/data/menu";

export const metadata: Metadata = {
  title: "Menú · Appetito",
  description: "Explora el menú de Appetito y arma tu pedido.",
};

export default function MenuPage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Nuestro menú</h1>
      <MenuBrowser dishes={dishes} categories={categories} />
    </>
  );
}
