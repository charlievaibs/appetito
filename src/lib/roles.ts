/**
 * Roles del equipo de un restaurante y qué puede hacer cada uno.
 *
 * IMPORTANTE: esta matriz REPLICA la función SQL `private.has_permission`. Sirve
 * para mostrar u ocultar opciones en la interfaz; la que realmente protege los
 * datos es la base de datos, que vuelve a comprobar cada acción.
 */

export const ROLES = ["owner", "manager", "host", "waiter", "kitchen", "cashier"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "orders.view"
  | "orders.take"
  | "orders.kitchen"
  | "orders.serve"
  | "orders.cancel"
  | "session.close"
  | "tables.edit"
  | "menu.edit"
  | "settings.edit"
  | "team.manage";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  manager: "Gerente",
  host: "Anfitrión",
  waiter: "Mesero",
  kitchen: "Cocina",
  cashier: "Caja",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Todo, incluido el equipo.",
  manager: "Menú, mesas, ajustes y equipo (menos dueños y gerentes).",
  host: "Mesas, reservas, tomar pedidos y servir.",
  waiter: "Tomar pedidos, enviarlos a cocina, servir y cerrar mesas.",
  kitchen: "Ver pedidos, prepararlos y marcarlos listos.",
  cashier: "Ver pedidos y cerrar mesas.",
};

const PERMISSIONS: Record<Permission, readonly Role[]> = {
  "orders.view": ROLES,
  "orders.take": ["owner", "manager", "host", "waiter"],
  "orders.kitchen": ["owner", "manager", "kitchen", "waiter"],
  "orders.serve": ["owner", "manager", "host", "waiter"],
  "orders.cancel": ["owner", "manager", "waiter", "kitchen"],
  "session.close": ["owner", "manager", "host", "waiter", "cashier"],
  "tables.edit": ["owner", "manager", "host"],
  "menu.edit": ["owner", "manager"],
  "settings.edit": ["owner", "manager"],
  "team.manage": ["owner", "manager"],
};

/** ¿Este rol tiene este permiso? Sin rol (null) no se puede nada. */
export function can(role: Role | null, permission: Permission): boolean {
  return role !== null && PERMISSIONS[permission].includes(role);
}

/** Roles que puede asignar quien tiene `role`: el dueño todos; el gerente solo los de operación. */
export function assignableRoles(role: Role | null): Role[] {
  if (role === "owner") return [...ROLES];
  if (role === "manager") return ["host", "waiter", "kitchen", "cashier"];
  return [];
}

/** Convierte un texto en un rol válido; null si no lo es. */
export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}
