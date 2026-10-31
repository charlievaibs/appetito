import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

export type Restaurant = Tables["restaurants"]["Row"];
export type DbDish = Tables["dishes"]["Row"];
export type DiningTable = Tables["dining_tables"]["Row"];
export type Seat = Tables["seats"]["Row"];
export type Order = Tables["orders"]["Row"];
export type OrderItem = Tables["order_items"]["Row"];

export type OrderingMode = "staff" | "qr_optional" | "qr";
export type Identification = "table" | "seat" | "reservation";
export type OrderStatus = "received" | "preparing" | "served" | "cancelled";
