/**
 * Tipos de dominio derivados del esquema de Supabase (ver database.types.ts).
 * Las columnas de texto con valores fijos (estados, modos…) se estrechan aquí
 * a uniones de cadenas para que TypeScript compruebe los casos.
 */
import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

export type Restaurant = Tables["restaurants"]["Row"];
export type DbDish = Tables["dishes"]["Row"];
export type DiningTable = Tables["dining_tables"]["Row"];
export type Seat = Tables["seats"]["Row"];
export type TableSession = Tables["table_sessions"]["Row"];
export type OrderItem = Tables["order_items"]["Row"];
export type ChangeRequest = Tables["change_requests"]["Row"];
export type ServiceRequest = Tables["service_requests"]["Row"];
export type DishOptionGroup = Tables["dish_option_groups"]["Row"];
export type DishOption = Tables["dish_options"]["Row"];

/** Un grupo de opciones con sus opciones (como lo devuelve `select("*, dish_options(*)")`). */
export type OptionGroup = DishOptionGroup & { dish_options: DishOption[] };

/** Un plato con sus grupos de opciones. */
export type DishWithOptions = DbDish & { dish_option_groups: OptionGroup[] };

/** Cómo se toman los pedidos: solo personal, QR/NFC opcional, o los comensales piden solos. */
export type OrderingMode = "staff" | "qr_optional" | "qr";

/** Cómo se identifica a cada comensal. */
export type Identification = "table" | "seat" | "reservation";

/** Hasta cuándo se puede cambiar un plato ya pedido. */
export type ChangePolicy = "before_kitchen" | "until_ready";

/** Ciclo de vida de un plato pedido. */
export type ItemStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";
