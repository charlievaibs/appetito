import type { Dish } from "@/lib/types";

export const dishes: Dish[] = [
  {
    id: "hamburguesa-clasica",
    name: "Hamburguesa Clásica",
    description:
      "Carne 100% res, lechuga, tomate, cebolla y nuestra salsa especial.",
    priceCents: 1299,
    category: "Hamburguesas",
    emoji: "🍔",
  },
  {
    id: "hamburguesa-bbq",
    name: "Hamburguesa BBQ",
    description: "Doble carne, queso cheddar, tocino crujiente y salsa BBQ ahumada.",
    priceCents: 1450,
    category: "Hamburguesas",
    emoji: "🍔",
  },
  {
    id: "pizza-margherita",
    name: "Pizza Margherita",
    description: "Salsa de tomate, mozzarella fresca y albahaca.",
    priceCents: 1550,
    category: "Pizzas",
    emoji: "🍕",
  },
  {
    id: "pizza-pepperoni",
    name: "Pizza Pepperoni",
    description: "Mozzarella, abundante pepperoni y un toque de orégano.",
    priceCents: 1699,
    category: "Pizzas",
    emoji: "🍕",
  },
  {
    id: "tacos-al-pastor",
    name: "Tacos al Pastor",
    description: "Tres tacos con carne al pastor, piña, cebolla y cilantro.",
    priceCents: 899,
    category: "Mexicana",
    emoji: "🌮",
  },
  {
    id: "burrito-de-pollo",
    name: "Burrito de Pollo",
    description: "Pollo a la parrilla, arroz, frijoles, queso y pico de gallo.",
    priceCents: 1050,
    category: "Mexicana",
    emoji: "🌯",
  },
  {
    id: "sushi-roll",
    name: "Sushi Roll",
    description: "Ocho piezas de roll con salmón, aguacate y pepino.",
    priceCents: 1875,
    category: "Japonesa",
    emoji: "🍣",
  },
  {
    id: "ramen",
    name: "Ramen",
    description: "Caldo de cerdo, fideos frescos, huevo marinado y cebollín.",
    priceCents: 1425,
    category: "Japonesa",
    emoji: "🍜",
  },
  {
    id: "pasta-carbonara",
    name: "Pasta Carbonara",
    description: "Salsa carbonara cremosa, tocino y queso parmesano.",
    priceCents: 1325,
    category: "Italiana",
    emoji: "🍝",
  },
  {
    id: "ensalada-cesar",
    name: "Ensalada César",
    description: "Lechuga romana, crutones, queso parmesano y aderezo césar.",
    priceCents: 999,
    category: "Ensaladas",
    emoji: "🥗",
  },
  {
    id: "brownie",
    name: "Brownie con Helado",
    description: "Brownie tibio de chocolate con una bola de helado de vainilla.",
    priceCents: 650,
    category: "Postres",
    emoji: "🍫",
  },
  {
    id: "limonada",
    name: "Limonada Natural",
    description: "Limones recién exprimidos, hielo y un toque de hierbabuena.",
    priceCents: 450,
    category: "Bebidas",
    emoji: "🍋",
  },
];

export const categories = Array.from(new Set(dishes.map((d) => d.category)));

export function getDish(id: string): Dish | undefined {
  return dishes.find((d) => d.id === id);
}
