export type Dish = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  emoji: string;
};

export type CartLine = {
  dishId: string;
  quantity: number;
};
