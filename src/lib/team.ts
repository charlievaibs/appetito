/** Lectura tipada de la respuesta de `list_team` (miembros e invitaciones pendientes). */
import type { Json } from "./database.types";
import { parseRole, type Role } from "./roles";

export type TeamMember = { userId: string; email: string; role: Role };
export type TeamInvite = { id: string; email: string; role: Role };
export type Team = { members: TeamMember[]; invites: TeamInvite[] };

function entries(value: Json | undefined): Record<string, Json | undefined>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Record<string, Json | undefined> => typeof v === "object" && v !== null && !Array.isArray(v),
  );
}

/** Descarta las entradas mal formadas en lugar de romper la pantalla. */
export function parseTeam(json: Json): Team {
  const root = typeof json === "object" && json !== null && !Array.isArray(json) ? json : {};
  const members = entries(root.members).flatMap((m) => {
    const role = parseRole(m.role);
    return typeof m.user_id === "string" && role
      ? [{ userId: m.user_id, email: typeof m.email === "string" ? m.email : "(sin correo)", role }]
      : [];
  });
  const invites = entries(root.invites).flatMap((i) => {
    const role = parseRole(i.role);
    return typeof i.id === "string" && typeof i.email === "string" && role
      ? [{ id: i.id, email: i.email, role }]
      : [];
  });
  return { members, invites };
}
