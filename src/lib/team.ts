/**
 * Lectura tipada de las respuestas del equipo: miembros e invitaciones (`list_team`), rendimiento
 * (`staff_performance`) y nombres para mostrar quién atiende cada mesa (`list_staff_names`).
 */
import type { Json } from "./database.types";
import { parseRole, type Role } from "./roles";

export type TeamMember = {
  userId: string;
  email: string;
  role: Role;
  /** Nombre que puso la persona; null si aún no lo ha puesto. */
  displayName: string | null;
  /** false = suspendido: conserva la cuenta pero no tiene acceso. */
  active: boolean;
  /** Mesas abiertas que atiende ahora. */
  openTables: number;
};
export type TeamInvite = { id: string; email: string; role: Role };
export type Team = { members: TeamMember[]; invites: TeamInvite[] };

type Entry = Record<string, Json | undefined>;

function entries(value: Json | undefined): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Entry => typeof v === "object" && v !== null && !Array.isArray(v));
}

const num = (v: Json | undefined): number => (typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0);

/** Nombre para mostrar de una persona: el que puso, o el correo, o un texto neutro. */
export function personLabel(person: { displayName: string | null; email?: string }): string {
  return person.displayName?.trim() || person.email || "Sin nombre";
}

/** Descarta las entradas mal formadas en lugar de romper la pantalla. */
export function parseTeam(json: Json): Team {
  const root = typeof json === "object" && json !== null && !Array.isArray(json) ? json : {};
  const members = entries(root.members).flatMap((m): TeamMember[] => {
    const role = parseRole(m.role);
    return typeof m.user_id === "string" && role
      ? [
          {
            userId: m.user_id,
            email: typeof m.email === "string" ? m.email : "(sin correo)",
            role,
            displayName: typeof m.display_name === "string" && m.display_name.trim() ? m.display_name : null,
            active: m.active !== false,
            openTables: num(m.open_tables),
          },
        ]
      : [];
  });
  const invites = entries(root.invites).flatMap((i) => {
    const role = parseRole(i.role);
    return typeof i.id === "string" && typeof i.email === "string" && role ? [{ id: i.id, email: i.email, role }] : [];
  });
  return { members, invites };
}

/** Un nombre del equipo (sin correo) para etiquetar mesas. */
export type StaffName = { userId: string; name: string | null; role: Role };

export function parseStaffNames(json: Json): StaffName[] {
  return entries(Array.isArray(json) ? json : undefined).flatMap((e): StaffName[] => {
    const role = parseRole(e.role);
    return typeof e.user_id === "string" && role
      ? [{ userId: e.user_id, name: typeof e.name === "string" && e.name.trim() ? e.name : null, role }]
      : [];
  });
}

/** Rendimiento de una persona en un periodo. Los importes van en céntimos de la moneda base (con IVA). */
export type StaffPerformance = {
  userId: string;
  role: Role;
  displayName: string | null;
  email: string;
  active: boolean;
  tables: number;
  itemsTaken: number;
  salesCents: number;
  collectedCents: number;
  collectedCount: number;
  avgMinutes: number | null;
  openTables: number;
};

export function parsePerformance(json: Json): StaffPerformance[] {
  return entries(Array.isArray(json) ? json : undefined).flatMap((e): StaffPerformance[] => {
    const role = parseRole(e.role);
    if (typeof e.user_id !== "string" || !role) return [];
    return [
      {
        userId: e.user_id,
        role,
        displayName: typeof e.display_name === "string" && e.display_name.trim() ? e.display_name : null,
        email: typeof e.email === "string" ? e.email : "",
        active: e.active !== false,
        tables: num(e.tables),
        itemsTaken: num(e.items_taken),
        salesCents: num(e.sales_cents),
        collectedCents: num(e.collected_cents),
        collectedCount: num(e.collected_count),
        avgMinutes: e.avg_minutes === null || e.avg_minutes === undefined ? null : num(e.avg_minutes),
        openTables: num(e.open_tables),
      },
    ];
  });
}

/** Periodos para el rendimiento: desde cuándo hasta ahora. */
export type PerformanceRange = "today" | "week" | "month";

export function rangeStart(range: PerformanceRange, now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") start.setDate(start.getDate() - 6);
  if (range === "month") start.setDate(start.getDate() - 29);
  return start;
}

/** Frase corta para un evento del registro de actividad del equipo. */
export function describeStaffEvent(action: string, detail: Json): string {
  const d = typeof detail === "object" && detail !== null && !Array.isArray(detail) ? detail : {};
  switch (action) {
    case "link_created":
      return `Creó un enlace para ${typeof d.role === "string" ? d.role : "el equipo"}`;
    case "link_revoked":
      return "Revocó un enlace de unión";
    case "joined_by_link":
      return "Se unió al equipo con un enlace";
    case "role_changed":
      return `Cambió el rol (${String(d.from ?? "?")} → ${String(d.to ?? "?")})`;
    case "suspended":
      return "Suspendió el acceso";
    case "reactivated":
      return "Reactivó el acceso";
    case "removed":
      return "Dio de baja a una persona";
    case "table_assigned":
      return `Asignó la mesa ${typeof d.table === "string" ? d.table : ""}`.trim();
    case "account_created":
      return "Creó una cuenta de empleado";
    default:
      return action;
  }
}
